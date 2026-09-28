/**
 * Client-side counterpart to src/pipeline/playgroundFields.ts's
 * makePlaygroundFieldsConfigurable(): every @playgroundField (string/number/
 * boolean) property in a built single-html already reads its default from
 * `window.__playgroundConfig[groupKey][propName]` (falling back to the
 * field's own original default when absent — see that function's doc
 * comment). So applying an edit here never needs another server round-trip
 * through /api/preview — it's just a small standalone script re-injected
 * into the *same* already-built html, reloaded fresh so the config is read
 * before the target class ever runs (no onLoad()/start()-timing race, since
 * this script runs synchronously before any — necessarily async-loaded —
 * game module).
 *
 * `groupKey` = the field's @playgroundField `section` option when given
 * (e.g. "Background Music"), else the component's class name — see
 * playgroundGroupKey() in src/pipeline/playgroundFields.ts, which this must
 * mirror exactly (callers here already do: see splitOverrides in app/page.tsx).
 * Note a section name is a human-friendly UI-grouping label, not guaranteed
 * unique — two different classes CAN share a section, in which case their
 * fields land under the same config key (accepted tradeoff, not a bug).
 */

/** A single @playgroundField property override, addressed by group key + prop name (not by scene node). */
export interface PlaygroundConfigOverride {
  groupKey: string;
  propName: string;
  value: string | number | boolean;
}

const CONFIG_SCRIPT_MARKER = "data-playground-config";

function toConfigObject(overrides: PlaygroundConfigOverride[]): Record<string, Record<string, string | number | boolean>> {
  const config: Record<string, Record<string, string | number | boolean>> = {};
  for (const { groupKey, propName, value } of overrides) {
    config[groupKey] = config[groupKey] || {};
    config[groupKey][propName] = value;
  }
  return config;
}

/**
 * Replaces (or inserts) the `window.__playgroundConfig = {...}` script at the
 * very top of `<head>` so it runs before anything else on the page —
 * including PLAYGROUND_CONFIG_BOOTSTRAP's own `window.__playgroundConfig =
 * window.__playgroundConfig || {}` further down in `<body>`, which only fills
 * in a default when the value is still unset, so ours (set first) wins either way.
 */
export function injectPlaygroundConfig(baseHtml: string, overrides: PlaygroundConfigOverride[]): string {
  const doc = new DOMParser().parseFromString(baseHtml, "text/html");
  doc.querySelector(`script[${CONFIG_SCRIPT_MARKER}]`)?.remove();
  if (overrides.length > 0) {
    const el = doc.createElement("script");
    el.setAttribute(CONFIG_SCRIPT_MARKER, "true");
    el.textContent = `window.__playgroundConfig = ${JSON.stringify(toConfigObject(overrides))};`;
    doc.head.insertBefore(el, doc.head.firstChild);
  }
  return "<!DOCTYPE html>\n" + doc.documentElement.outerHTML;
}
