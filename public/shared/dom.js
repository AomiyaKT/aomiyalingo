export function makeElement(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}
export function setTextIfChanged(node, value) {
  const text = value == null ? '' : String(value);
  if (node.textContent === text) return false;
  node.textContent = text;
  return true;
}
export function setAttributeIfChanged(node, name, value) {
  const text = String(value);
  if (node.getAttribute(name) === text) return false;
  node.setAttribute(name, text);
  return true;
}
// Only trusted sprite identifiers are interpolated into markup.
export function svgMarkup(id) {
  if (!/^[a-z][a-z0-9-]*$/.test(id)) throw Error('Invalid icon identifier');
  return `<svg aria-hidden="true" focusable="false"><use href="#i-${id}"/></svg>`;
}
