<?php
/**
 * Plugin Name: Bright Migrate Export
 * Description: Read-only export of Yoast SEO fields for the Payload CMS import. Remove after the move.
 * Version: 1.0.0
 *
 * Install: copy to wp-content/mu-plugins/bright-migrate.php and add to wp-config.php
 *   define('BRIGHT_MIGRATE_KEY', '<long random string>');
 * The import script sends the same value in the X-Migrate-Key header (WP_MIGRATE_KEY in apps/cms/.env).
 *
 * GET /wp-json/bright-migrate/v1/seo?ids=1,2,3   (max 100 ids)
 * → { "1": { title, description, focusKeyword, canonical, noindex, nofollow, primaryCategory }, … }
 * Only values an editor set in Yoast are returned; empty = Yoast default.
 */

if (!defined('ABSPATH')) exit;

add_action('rest_api_init', function () {
    register_rest_route('bright-migrate/v1', '/seo', [
        'methods' => 'GET',
        'permission_callback' => function (WP_REST_Request $req) {
            if (!defined('BRIGHT_MIGRATE_KEY') || strlen(BRIGHT_MIGRATE_KEY) < 24) return false;
            return hash_equals(BRIGHT_MIGRATE_KEY, (string) $req->get_header('x-migrate-key'));
        },
        'args' => ['ids' => ['required' => true, 'type' => 'string']],
        'callback' => function (WP_REST_Request $req) {
            $ids = array_slice(array_filter(array_map('absint', explode(',', $req['ids']))), 0, 100);
            if (!$ids) return new WP_REST_Response((object) []);
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
                    'ogImage' => $m('_yoast_wpseo_opengraph-image'),
                    'primaryCategory' => ($p = $m('_yoast_wpseo_primary_category')) ? (int) $p : null,
                ];
            }
            return new WP_REST_Response((object) $out);
        },
    ]);
});
