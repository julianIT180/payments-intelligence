import sanitizeHtml from 'sanitize-html';

// Trust boundary for the weekly report.
//
// report_html is built by the "Build HTML" node of the Weekly Payments Report
// workflow. That node HTML-escapes the model's text and only emits a fixed set of
// tags, so the stored value is already constrained. This function is defence in
// depth on the read path: whatever ends up in the column, only an explicit
// allowlist of tags, attributes and CSS properties is rendered. Scripts, iframes,
// event handlers and javascript:/data: URLs are dropped.
//
// The allowlist is deliberately wide enough to keep the existing report design
// (headings, lists, and the inline-styled layout wrapper) rendering unchanged.

const SAFE_STYLE = [
  /^#(?:[0-9a-fA-F]{3,8})$/,
  /^-?\d+(?:\.\d+)?(?:px|em|rem|%|pt)?$/,
  /^[a-zA-Z-]+$/, // keywords: uppercase, sans-serif, 600, none, auto, center …
  /^(?:normal|inherit|initial|unset)$/,
  /^\d+(?:\.\d+)?\s+\d+(?:\.\d+)?\s+\d+(?:\.\d+)?$/, // rgb-ish triplets, spacing shorthands
  /^[-\w\s,#().%/]+$/, // font stacks, "1px solid #ccc", "32px 24px"
];

export function sanitizeReportHtml(dirty) {
  if (!dirty) return '';

  return sanitizeHtml(String(dirty), {
    allowedTags: [
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'p', 'div', 'span', 'br', 'hr',
      'ul', 'ol', 'li',
      'strong', 'em', 'b', 'i', 'u', 's', 'small', 'blockquote', 'code', 'pre',
      'a',
      'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td',
    ],
    allowedAttributes: {
      '*': ['style'],
      a: ['href', 'target', 'rel'],
      td: ['colspan', 'rowspan'],
      th: ['colspan', 'rowspan'],
    },
    allowedStyles: {
      '*': {
        color: SAFE_STYLE,
        'background': SAFE_STYLE,
        'background-color': SAFE_STYLE,
        'font-family': SAFE_STYLE,
        'font-size': SAFE_STYLE,
        'font-weight': SAFE_STYLE,
        'font-style': SAFE_STYLE,
        'line-height': SAFE_STYLE,
        'letter-spacing': SAFE_STYLE,
        'text-align': SAFE_STYLE,
        'text-transform': SAFE_STYLE,
        'text-decoration': SAFE_STYLE,
        margin: SAFE_STYLE,
        'margin-top': SAFE_STYLE,
        'margin-bottom': SAFE_STYLE,
        padding: SAFE_STYLE,
        'padding-bottom': SAFE_STYLE,
        'padding-top': SAFE_STYLE,
        border: SAFE_STYLE,
        'border-top': SAFE_STYLE,
        'border-bottom': SAFE_STYLE,
        'max-width': SAFE_STYLE,
        width: SAFE_STYLE,
        display: SAFE_STYLE,
      },
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    allowedSchemesByTag: { a: ['http', 'https', 'mailto'] },
    disallowedTagsMode: 'discard',
    // strip <html>/<head>/<body>/<style>/<script>/<title>/<meta> wrappers but keep text
    nonTextTags: ['style', 'script', 'textarea', 'option', 'noscript', 'head', 'title'],
    transformTags: {
      a: (tagName, attribs) => ({
        tagName: 'a',
        attribs: {
          ...attribs,
          target: '_blank',
          rel: 'noopener noreferrer nofollow',
        },
      }),
    },
  });
}
