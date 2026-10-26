import qrcode from 'qrcode-generator';

export function lessonLink(origin, kind, id) {
  const url = new URL(kind === 'race' ? '/race' : '/student', origin);
  url.searchParams.set(kind === 'race' ? 'race' : 'class', id);
  return url.href;
}

export function renderClassroomLink(image, link, origin, kind, id) {
  image.hidden = !id;
  link.hidden = !id;
  if (!id) {
    image.removeAttribute('src');
    link.removeAttribute('href');
    return;
  }
  const href = lessonLink(origin, kind, id);
  if (link.href === href && image.dataset.classroom === id) return;
  const code = qrcode(0, 'M');
  code.addData(href);
  code.make();
  image.src =
    'data:image/svg+xml;charset=utf-8,' +
    encodeURIComponent(code.createSvgTag({ cellSize: 5, margin: 20, scalable: true }));
  image.dataset.classroom = id;
  link.href = href;
}
