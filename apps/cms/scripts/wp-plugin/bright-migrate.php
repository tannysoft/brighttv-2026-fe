<?php
/**
 * Plugin Name: Bright Migrate Export
 * Description: Read-only export of everything the Payload CMS import needs (drafts, users, custom fields, SEO, redirects, menus). Remove after the move.
 * Version: 2.0.0
 *
 * Install (as a must-use plugin, so it can't be switched off by mistake):
 *   1. copy this file to wp-content/mu-plugins/bright-migrate.php
 *   2. add to wp-config.php (any long random string, e.g. `openssl rand -hex 32`):
 *        define('BRIGHT_MIGRATE_KEY', '…');
 *   3. put the same value in apps/cms/.env as WP_MIGRATE_KEY
 * Every request needs the X-Migrate-Key header (send it over HTTPS only). Everything is GET
 * and read-only. No password hashes or login secrets are ever returned.
 * Delete the file and the define after the cutover.
 *
 * Endpoints (/wp-json/bright-migrate/v1/…):
 *   inventory               post types × status counts, taxonomies, ACF field
 *                           groups, custom field keys per post type, plugin tables
 *   proxy?route=/wp/v2/…    a core REST GET (posts, pages, program, lottery,
 *                           media, users, categories, tags, position) run as an
 *                           administrator: drafts/pending/private/future, raw
 *                           content, user emails and roles. Query args pass through.
 *   meta?ids=1,2            every custom field of up to 100 posts/pages/CPT items
 *                           (raw ACF values incl. repeaters, plus other post meta)
 *   seo?ids=1,2             Yoast fields of up to 100 items
 *   user-meta?ids=1,2       profile custom fields (ACF + safe user meta) of up to 100 users
 *   terms?taxonomy=category every term with term meta, raw ACF and Yoast term SEO
 *   redirects               Redirection plugin rules
 *   menus                   navigation menus and their items
 *   options                 ACF options pages and basic site settings
 */

if (!defined('ABSPATH')) exit;

const BRIGHT_MIGRATE_NS = 'bright-migrate/v1';

/** Core routes the proxy may read. */
const BRIGHT_MIGRATE_ROUTES = ['posts', 'pages', 'program', 'lottery', 'media', 'users', 'categories', 'tags', 'position'];

/** Meta that is internal to WordPress / plugins, or secret. Never exported. */
function bright_migrate_skip_meta(string $key): bool {
    static $exact = [
        '_edit_lock', '_edit_last', '_wp_old_slug', '_wp_old_date', '_encloseme', '_pingme', '_wp_trash_meta_status',
        '_wp_trash_meta_time', '_wp_desired_post_slug', '_wp_page_template', '_thumbnail_id', '_wp_attached_file',
        '_wp_attachment_metadata', '_wp_attachment_backup_sizes', 'footnotes',
        // users: secrets and session data
        'session_tokens', '_application_passwords', 'user_activation_key', 'default_password_nag',
        'community-events-location', 'dismissed_wp_pointers',
    ];
    if (in_array($key, $exact, true)) return true;
    // ACF stores a "_field" reference next to every value; Yoast is exported by /seo.
    if (str_starts_with($key, '_yoast_') || str_starts_with($key, '_oembed_') || str_starts_with($key, '_transient')) return true;
    if (preg_match('/(password|passwd|secret|token|nonce|_2fa|two_factor|itsec|otp|recovery)/i', $key)) return true;
    return false;
}

function bright_migrate_allowed(WP_REST_Request $req): bool {
    if (!defined('BRIGHT_MIGRATE_KEY') || strlen(BRIGHT_MIGRATE_KEY) < 32) return false;
    return hash_equals(BRIGHT_MIGRATE_KEY, (string) $req->get_header('x-migrate-key'));
}

/** Run the rest of the request as the first administrator (read-only use). */
function bright_migrate_as_admin(): void {
    static $done = false;
    if ($done) return;
    $admins = get_users(['role' => 'administrator', 'number' => 1, 'orderby' => 'ID', 'fields' => 'ID']);
    if ($admins) wp_set_current_user((int) $admins[0]);
    $done = true;
}

function bright_migrate_ids(WP_REST_Request $req): array {
    return array_slice(array_values(array_unique(array_filter(array_map('absint', explode(',', (string) $req['ids']))))), 0, 100);
}

/** Unserialized meta, without internal/secret keys and ACF's "_name" references. */
function bright_migrate_clean_meta(array $all): array {
    $out = [];
    foreach ($all as $key => $values) {
        if (bright_migrate_skip_meta($key)) continue;
        if (str_starts_with($key, '_') && isset($all[substr($key, 1)])) continue; // ACF field-key reference
        // Values ACF manages (incl. repeater rows like gallery_0_image) come in raw form under "acf".
        $ref = $all['_' . $key][0] ?? null;
        if (is_string($ref) && str_starts_with($ref, 'field_')) continue;
        $vals = array_map('maybe_unserialize', (array) $values);
        $out[$key] = count($vals) === 1 ? $vals[0] : $vals;
    }
    return $out;
}

/**
 * Raw ACF values (no formatting: ids stay ids) with repeater / flexible
 * content rows keyed by field name instead of "field_…" keys.
 */
function bright_migrate_acf($selector) {
    if (!function_exists('get_fields')) return (object) [];
    $names = function ($v) use (&$names) {
        if (!is_array($v)) return $v;
        $out = [];
        foreach ($v as $k => $x) {
            if (is_string($k) && str_starts_with($k, 'field_') && ($f = acf_get_field($k))) $k = $f['name'];
            $out[$k] = $names($x);
        }
        return $out;
    };
    $fields = get_fields($selector, false);
    return $fields ? (object) $names($fields) : (object) [];
}

function bright_migrate_route(string $path, callable $cb, array $args = []): void {
    register_rest_route(BRIGHT_MIGRATE_NS, $path, [
        'methods' => 'GET',
        'permission_callback' => 'bright_migrate_allowed',
        'args' => $args,
        'callback' => function (WP_REST_Request $req) use ($cb) {
            bright_migrate_as_admin();
            return $cb($req);
        },
    ]);
}

add_action('rest_api_init', function () {
    global $wpdb;

    // ---------- inventory ----------
    bright_migrate_route('/inventory', function () use ($wpdb) {
        $types = [];
        foreach (get_post_types([], 'objects') as $name => $t) {
            if (in_array($name, ['revision', 'nav_menu_item', 'customize_changeset', 'oembed_cache', 'user_request', 'wp_block', 'wp_template', 'wp_template_part', 'wp_global_styles', 'wp_navigation', 'wp_font_family', 'wp_font_face', 'acf-field-group', 'acf-field', 'acf-post-type', 'acf-taxonomy', 'acf-ui-options-page'], true)) continue;
            $types[$name] = [
                'label' => $t->label,
                'public' => (bool) $t->public,
                'rest_base' => $t->show_in_rest ? ($t->rest_base ?: $name) : null,
                'taxonomies' => get_object_taxonomies($name),
                'supports' => array_keys(get_all_post_type_supports($name)),
                'counts' => (array) wp_count_posts($name),
            ];
        }
        $taxonomies = [];
        foreach (get_taxonomies([], 'objects') as $name => $t) {
            if (in_array($name, ['nav_menu', 'link_category', 'post_format', 'wp_theme', 'wp_template_part_area', 'wp_pattern_category'], true)) continue;
            $taxonomies[$name] = ['label' => $t->label, 'types' => $t->object_type, 'hierarchical' => (bool) $t->hierarchical, 'count' => (int) wp_count_terms(['taxonomy' => $name, 'hide_empty' => false])];
        }
        // Custom field keys actually used, per post type (how many items have each).
        $metaKeys = [];
        $rows = $wpdb->get_results(
            "SELECT p.post_type, m.meta_key, COUNT(DISTINCT m.post_id) AS n
             FROM {$wpdb->postmeta} m JOIN {$wpdb->posts} p ON p.ID = m.post_id
             WHERE p.post_type NOT IN ('revision','nav_menu_item','customize_changeset','oembed_cache')
             GROUP BY p.post_type, m.meta_key ORDER BY p.post_type, n DESC"
        );
        foreach ($rows as $r) {
            if (bright_migrate_skip_meta($r->meta_key)) continue;
            if (str_starts_with($r->meta_key, '_') && !str_starts_with($r->meta_key, '_yoast')) {
                // ACF "_field" references are skipped; other private keys are listed.
                $peer = substr($r->meta_key, 1);
                $hasPeer = (bool) $wpdb->get_var($wpdb->prepare("SELECT 1 FROM {$wpdb->postmeta} WHERE meta_key = %s LIMIT 1", $peer));
                if ($hasPeer) continue;
            }
            $metaKeys[$r->post_type][$r->meta_key] = (int) $r->n;
        }
        $userMetaKeys = [];
        foreach ($wpdb->get_results("SELECT meta_key, COUNT(*) AS n FROM {$wpdb->usermeta} GROUP BY meta_key ORDER BY n DESC") as $r) {
            if (!bright_migrate_skip_meta($r->meta_key) && !str_starts_with($r->meta_key, $wpdb->prefix)) $userMetaKeys[$r->meta_key] = (int) $r->n;
        }
        $termMetaKeys = [];
        foreach ($wpdb->get_results("SELECT meta_key, COUNT(*) AS n FROM {$wpdb->termmeta} GROUP BY meta_key ORDER BY n DESC") as $r) {
            if (!bright_migrate_skip_meta($r->meta_key)) $termMetaKeys[$r->meta_key] = (int) $r->n;
        }
        $acf = [];
        if (function_exists('acf_get_field_groups')) {
            $simplify = function ($fields) use (&$simplify) {
                return array_map(fn ($f) => array_filter([
                    'name' => $f['name'], 'label' => $f['label'], 'type' => $f['type'],
                    'choices' => $f['choices'] ?? null, 'return_format' => $f['return_format'] ?? null,
                    'multiple' => $f['multiple'] ?? null, 'post_type' => $f['post_type'] ?? null,
                    'sub_fields' => isset($f['sub_fields']) ? $simplify($f['sub_fields']) : null,
                    'layouts' => isset($f['layouts']) ? array_map(fn ($l) => ['name' => $l['name'], 'sub_fields' => $simplify($l['sub_fields'] ?? [])], $f['layouts']) : null,
                ], fn ($v) => $v !== null && $v !== ''), $fields ?: []);
            };
            foreach (acf_get_field_groups() as $g) {
                $acf[] = ['title' => $g['title'], 'active' => (bool) $g['active'], 'location' => $g['location'], 'fields' => $simplify(acf_get_fields($g))];
            }
        }
        $users = count_users();
        $tables = $wpdb->get_col("SHOW TABLES LIKE '{$wpdb->prefix}%'");
        return [
            'site' => ['url' => home_url(), 'wp' => get_bloginfo('version'), 'plugins' => array_values(get_option('active_plugins', []))],
            'post_types' => $types,
            'taxonomies' => $taxonomies,
            'users' => ['total' => $users['total_users'], 'roles' => $users['avail_roles']],
            'acf_field_groups' => $acf,
            'acf_options_pages' => function_exists('acf_get_options_pages') ? array_keys((array) acf_get_options_pages()) : [],
            'meta_keys' => $metaKeys,
            'user_meta_keys' => $userMetaKeys,
            'term_meta_keys' => $termMetaKeys,
            'tables' => $tables,
        ];
    });

    // ---------- core REST as an administrator ----------
    bright_migrate_route('/proxy', function (WP_REST_Request $req) {
        $route = '/' . trim((string) $req['route'], '/');
        if (!preg_match('#^/wp/v2/([a-z_-]+)(/\d+)?$#', $route, $m) || !in_array($m[1], BRIGHT_MIGRATE_ROUTES, true)) {
            return new WP_Error('bright_migrate_route', 'Route not allowed', ['status' => 400]);
        }
        $inner = new WP_REST_Request('GET', $route);
        $params = $req->get_query_params();
        unset($params['route']);
        $inner->set_query_params($params);
        return rest_do_request($inner); // keeps X-WP-Total / X-WP-TotalPages
    }, ['route' => ['required' => true, 'type' => 'string']]);

    // ---------- custom fields ----------
    bright_migrate_route('/meta', function (WP_REST_Request $req) {
        $ids = bright_migrate_ids($req);
        if (!$ids) return (object) [];
        update_meta_cache('post', $ids);
        $out = [];
        foreach ($ids as $id) {
            if (!get_post($id)) continue;
            $out[$id] = [
                'acf' => bright_migrate_acf($id),
                'meta' => (object) bright_migrate_clean_meta(get_post_meta($id)),
                'template' => get_page_template_slug($id) ?: null,
                'password_protected' => post_password_required($id),
            ];
        }
        return (object) $out;
    }, ['ids' => ['required' => true, 'type' => 'string']]);

    bright_migrate_route('/seo', function (WP_REST_Request $req) {
        $ids = bright_migrate_ids($req);
        if (!$ids) return (object) [];
        update_meta_cache('post', $ids);
        $out = [];
        foreach ($ids as $id) {
            $m = function ($key) use ($id) {
                $v = get_post_meta($id, $key, true);
                return is_string($v) && $v !== '' ? $v : null;
            };
            $out[$id] = [
                'title' => $m('_yoast_wpseo_title'),
                'description' => $m('_yoast_wpseo_metadesc'),
                'focusKeyword' => $m('_yoast_wpseo_focuskw'),
                'canonical' => $m('_yoast_wpseo_canonical'),
                'noindex' => $m('_yoast_wpseo_meta-robots-noindex') === '1',
                'nofollow' => $m('_yoast_wpseo_meta-robots-nofollow') === '1',
                'ogTitle' => $m('_yoast_wpseo_opengraph-title'),
                'ogDescription' => $m('_yoast_wpseo_opengraph-description'),
                'ogImage' => $m('_yoast_wpseo_opengraph-image'),
                'primaryCategory' => ($p = $m('_yoast_wpseo_primary_category')) ? (int) $p : null,
            ];
        }
        return (object) $out;
    }, ['ids' => ['required' => true, 'type' => 'string']]);

    bright_migrate_route('/user-meta', function (WP_REST_Request $req) use ($wpdb) {
        $out = [];
        foreach (bright_migrate_ids($req) as $id) {
            $u = get_userdata($id);
            if (!$u) continue;
            $meta = array_filter(
                bright_migrate_clean_meta(get_user_meta($id)),
                fn ($k) => !str_starts_with($k, $wpdb->prefix) && !in_array($k, ['rich_editing', 'syntax_highlighting', 'comment_shortcuts', 'admin_color', 'use_ssl', 'show_admin_bar_front', 'locale', 'show_welcome_panel', 'infinite_scrolling', 'closedpostboxes_post', 'metaboxhidden_post', 'meta-box-order_post', 'manageedit-postcolumnshidden', 'edit_post_per_page', 'wp_dashboard_quick_press_last_post_id'], true),
                ARRAY_FILTER_USE_KEY
            );
            $out[$id] = [
                'login' => $u->user_login,
                'registered' => $u->user_registered,
                'url' => $u->user_url ?: null,
                'roles' => array_values($u->roles),
                'acf' => bright_migrate_acf('user_' . $id),
                'meta' => (object) $meta,
            ];
        }
        return (object) $out;
    }, ['ids' => ['required' => true, 'type' => 'string']]);

    // ---------- terms ----------
    bright_migrate_route('/terms', function (WP_REST_Request $req) {
        $tax = (string) $req['taxonomy'];
        if (!taxonomy_exists($tax)) return new WP_Error('bright_migrate_tax', 'Unknown taxonomy', ['status' => 400]);
        $page = max(1, (int) ($req['page'] ?: 1));
        $per = 500;
        $terms = get_terms(['taxonomy' => $tax, 'hide_empty' => false, 'orderby' => 'term_id', 'order' => 'ASC', 'number' => $per, 'offset' => ($page - 1) * $per]);
        $yoast = get_option('wpseo_taxonomy_meta', [])[$tax] ?? [];
        $items = array_map(fn ($t) => [
            'id' => $t->term_id, 'name' => $t->name, 'slug' => $t->slug, 'description' => $t->description,
            'parent' => $t->parent, 'count' => $t->count,
            'acf' => bright_migrate_acf($tax . '_' . $t->term_id),
            'meta' => (object) bright_migrate_clean_meta(get_term_meta($t->term_id)),
            'seo' => isset($yoast[$t->term_id]) ? array_filter([
                'title' => $yoast[$t->term_id]['wpseo_title'] ?? null,
                'description' => $yoast[$t->term_id]['wpseo_desc'] ?? null,
                'focusKeyword' => $yoast[$t->term_id]['wpseo_focuskw'] ?? null,
                'canonical' => $yoast[$t->term_id]['wpseo_canonical'] ?? null,
                'noindex' => ($yoast[$t->term_id]['wpseo_noindex'] ?? '') === 'noindex',
            ]) : null,
        ], is_array($terms) ? $terms : []);
        $total = (int) wp_count_terms(['taxonomy' => $tax, 'hide_empty' => false]);
        $res = new WP_REST_Response($items);
        $res->header('X-WP-Total', (string) $total);
        $res->header('X-WP-TotalPages', (string) max(1, (int) ceil($total / $per)));
        return $res;
    }, ['taxonomy' => ['required' => true, 'type' => 'string']]);

    // ---------- redirects (Redirection plugin) ----------
    bright_migrate_route('/redirects', function () use ($wpdb) {
        $table = $wpdb->prefix . 'redirection_items';
        if ($wpdb->get_var($wpdb->prepare('SHOW TABLES LIKE %s', $table)) !== $table) return [];
        $rows = $wpdb->get_results("SELECT id, url, match_url, match_type, regex, action_type, action_code, action_data, status, last_count, last_access FROM {$table} ORDER BY id", ARRAY_A);
        foreach ($rows as &$r) {
            // url / login / referrer matches keep their targets serialized.
            $data = maybe_unserialize($r['action_data']);
            $r['action_data'] = $data;
            $r['regex'] = (bool) $r['regex'];
        }
        return $rows;
    });

    // ---------- menus ----------
    bright_migrate_route('/menus', function () {
        $locations = get_nav_menu_locations();
        return array_map(function ($menu) use ($locations) {
            $items = wp_get_nav_menu_items($menu->term_id) ?: [];
            return [
                'id' => $menu->term_id, 'name' => $menu->name, 'slug' => $menu->slug,
                'locations' => array_keys(array_filter($locations, fn ($id) => (int) $id === $menu->term_id)),
                'items' => array_map(fn ($i) => [
                    'id' => $i->ID, 'parent' => (int) $i->menu_item_parent, 'order' => (int) $i->menu_order,
                    'title' => $i->title, 'url' => $i->url, 'type' => $i->type, 'object' => $i->object,
                    'object_id' => (int) $i->object_id, 'target' => $i->target ?: null, 'classes' => array_values(array_filter((array) $i->classes)),
                ], $items),
            ];
        }, wp_get_nav_menus());
    });

    // ---------- options ----------
    bright_migrate_route('/options', function () {
        $acf = bright_migrate_acf('option');
        return [
            'site' => [
                'name' => get_option('blogname'), 'description' => get_option('blogdescription'),
                'timezone' => get_option('timezone_string'), 'permalink' => get_option('permalink_structure'),
                'posts_per_page' => (int) get_option('posts_per_page'), 'sticky_posts' => array_map('intval', (array) get_option('sticky_posts', [])),
            ],
            'acf' => $acf,
        ];
    });
});
