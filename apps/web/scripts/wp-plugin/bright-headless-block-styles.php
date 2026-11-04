<?php
/**
 * Plugin Name: Bright Headless — Per-Post Block Styles
 * Description: Adds a `block_styles` field to /wp/v2/posts responses
 *              containing the compiled CSS for every wp-block-* stylesheet
 *              actually used inside that post's rendered content. Lets the
 *              headless front-end render Gutenberg block markup faithfully
 *              without shipping every block's CSS on every page.
 * Version:     1.0.0
 * Author:      Bright TV
 *
 * Drop this file into wp-content/plugins/ and activate via WP admin.
 *
 * Output (added to GET /wp-json/wp/v2/posts/{id}):
 *   {
 *     ...,
 *     "block_styles": "/* compiled CSS string for blocks used in this post *​/"
 *   }
 *
 * Notes
 *  - Results are cached in a transient keyed off post id + modified gmt, so
 *    edits in WP admin invalidate it for free.
 *  - Walks innerBlocks recursively so reusable blocks / nested groups work.
 *  - For core blocks we read /wp-includes/blocks/{name}/style.min.css directly.
 *  - For 3rd-party blocks we read each registered style_handle source file.
 *  - block-supports inline styles (e.g. per-block colour from attributes) are
 *    already inlined by do_blocks() into post.content.rendered, so they don't
 *    need to be transported separately.
 */

if (!defined('ABSPATH')) {
    exit;
}

namespace Bright\Headless\BlockStyles;

const REST_FIELD = 'block_styles';
const TRANSIENT_PREFIX = 'bright_block_styles_';

/**
 * Register the `block_styles` field on every public post type that uses the
 * Gutenberg editor. We start with `post`; add more if you need them.
 */
add_action('rest_api_init', function () {
    register_rest_field('post', REST_FIELD, [
        'schema'       => [
            'description' => 'Compiled CSS for wp-block-* stylesheets used in this post content.',
            'type'        => 'string',
            'context'     => ['view', 'edit'],
            'readonly'    => true,
        ],
        'get_callback' => __NAMESPACE__ . '\\get_post_block_styles_field',
    ]);
});

/**
 * REST field callback. Receives the prepared post array — fetch the WP_Post
 * to get raw post_content and modified time.
 */
function get_post_block_styles_field(array $post): string
{
    $post_obj = get_post($post['id']);
    if (!$post_obj) {
        return '';
    }
    return get_post_block_styles($post_obj);
}

/**
 * Public entry point: returns the compiled CSS string for one post, cached.
 */
function get_post_block_styles(\WP_Post $post): string
{
    $key   = TRANSIENT_PREFIX . $post->ID . '_' . md5((string) $post->post_modified_gmt);
    $cached = get_transient($key);
    if (is_string($cached)) {
        return $cached;
    }

    $css = build_post_block_styles($post);

    // 12h is plenty — the cache key includes post_modified_gmt so any edit
    // automatically yields a new key and recomputes.
    set_transient($key, $css, 12 * HOUR_IN_SECONDS);

    return $css;
}

/**
 * Build the CSS bundle from scratch (no cache).
 */
function build_post_block_styles(\WP_Post $post): string
{
    if (!function_exists('parse_blocks')) {
        return ''; // Pre-Gutenberg WP — nothing to do.
    }

    $block_names = collect_block_names(parse_blocks($post->post_content));
    if (empty($block_names)) {
        return '';
    }

    $chunks = [];
    foreach ($block_names as $block_name) {
        $chunk = get_css_for_block($block_name);
        if ($chunk !== '') {
            $chunks[] = "/* {$block_name} */\n{$chunk}";
        }
    }

    return implode("\n\n", $chunks);
}

/**
 * Walk the parsed-block tree and return a flat list of unique block names.
 */
function collect_block_names(array $blocks): array
{
    $names = [];
    $walk  = function (array $list) use (&$walk, &$names): void {
        foreach ($list as $block) {
            if (!empty($block['blockName'])) {
                $names[$block['blockName']] = true;
            }
            if (!empty($block['innerBlocks']) && is_array($block['innerBlocks'])) {
                $walk($block['innerBlocks']);
            }
        }
    };
    $walk($blocks);

    return array_keys($names);
}

/**
 * Resolve the CSS for a single block name. Tries:
 *   1. Registered style_handles on the WP_Block_Type
 *   2. Core block stylesheet at /wp-includes/blocks/{name}/style.min.css
 */
function get_css_for_block(string $block_name): string
{
    $css = '';

    $registry = \WP_Block_Type_Registry::get_instance();
    $type     = $registry->get_registered($block_name);

    // 1. Registered style handles (3rd-party blocks normally use this)
    if ($type && !empty($type->style_handles) && is_array($type->style_handles)) {
        foreach ($type->style_handles as $handle) {
            $css .= read_style_handle($handle);
        }
    }

    // 2. Core blocks: read the bundled stylesheet directly
    if (strpos($block_name, 'core/') === 0) {
        $slug = substr($block_name, 5);
        foreach (['style.min.css', 'style.css'] as $filename) {
            $path = ABSPATH . WPINC . '/blocks/' . $slug . '/' . $filename;
            if (file_exists($path)) {
                $css .= "\n" . (string) @file_get_contents($path);
                break;
            }
        }
    }

    return trim($css);
}

/**
 * Read the CSS associated with a wp_register_style() handle. Tries the
 * registered src (URL → filesystem path) and any wp_add_inline_style() data.
 */
function read_style_handle(string $handle): string
{
    $styles = wp_styles();
    if (!isset($styles->registered[$handle])) {
        return '';
    }

    $dep = $styles->registered[$handle];
    $css = '';

    // Source file
    if (!empty($dep->src)) {
        $path = url_to_filesystem_path((string) $dep->src);
        if ($path && file_exists($path)) {
            $css .= (string) @file_get_contents($path);
        }
    }

    // Inline styles attached via wp_add_inline_style()
    if (!empty($dep->extra['after']) && is_array($dep->extra['after'])) {
        foreach ($dep->extra['after'] as $extra) {
            if (is_string($extra)) {
                $css .= "\n" . $extra;
            }
        }
    }

    return $css;
}

/**
 * Convert a stylesheet URL emitted by wp_register_style() into an absolute
 * filesystem path. Returns null when the URL points off-site (CDN, plugin
 * registered with an absolute external URL, etc.).
 */
function url_to_filesystem_path(string $url): ?string
{
    if ($url === '' || strpos($url, 'http') !== 0 && strpos($url, '//') !== 0) {
        // Already a relative path or absolute filesystem path
        if ($url[0] === '/') {
            return ABSPATH . ltrim($url, '/');
        }
        return null;
    }

    $candidates = [
        [content_url(), WP_CONTENT_DIR],
        [includes_url(), ABSPATH . WPINC],
        [site_url('/'), ABSPATH],
        [site_url(), rtrim(ABSPATH, '/')],
    ];

    foreach ($candidates as [$base_url, $base_path]) {
        if ($base_url && strpos($url, $base_url) === 0) {
            $relative = substr($url, strlen($base_url));
            return rtrim($base_path, '/') . '/' . ltrim($relative, '/');
        }
    }

    return null;
}

/**
 * Aggressively bust the per-post transient when a post is saved/trashed.
 * Belt-and-braces — the modified_gmt key change already covers normal edits.
 */
add_action('save_post', __NAMESPACE__ . '\\flush_post_cache');
add_action('deleted_post', __NAMESPACE__ . '\\flush_post_cache');
function flush_post_cache(int $post_id): void
{
    global $wpdb;
    $like = $wpdb->esc_like('_transient_' . TRANSIENT_PREFIX . $post_id . '_') . '%';
    $wpdb->query(
        $wpdb->prepare(
            "DELETE FROM {$wpdb->options} WHERE option_name LIKE %s",
            $like
        )
    );
}
