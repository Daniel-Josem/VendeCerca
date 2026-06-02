import { useEffect } from 'react';

const DEFAULT_TITLE = 'VendeCerca — Compra a vendedores de tu barrio';
const DEFAULT_DESC  = 'Encuentra frutas, verduras y productos frescos cerca de ti. Domicilio o retiro. Apoya el comercio local.';
const DEFAULT_IMAGE = 'https://vendecerca.vercel.app/og-image.svg';

function setMeta(property, content, attr = 'property') {
  let el = document.querySelector(`meta[${attr}="${property}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, property);
    document.head.appendChild(el);
  }
  el.content = content;
}

export default function usePageMeta({ title, description, image } = {}) {
  useEffect(() => {
    const fullTitle = title ? `${title} | VendeCerca` : DEFAULT_TITLE;
    const desc      = description || DEFAULT_DESC;
    const img       = image || DEFAULT_IMAGE;

    document.title = fullTitle;

    setMeta('description',         desc,      'name');
    setMeta('og:title',            fullTitle);
    setMeta('og:description',      desc);
    setMeta('og:image',            img);
    setMeta('twitter:title',       fullTitle);
    setMeta('twitter:description', desc);
    setMeta('twitter:image',       img);

    return () => {
      document.title = DEFAULT_TITLE;
      setMeta('description',         DEFAULT_DESC,  'name');
      setMeta('og:title',            DEFAULT_TITLE);
      setMeta('og:description',      DEFAULT_DESC);
      setMeta('og:image',            DEFAULT_IMAGE);
      setMeta('twitter:title',       DEFAULT_TITLE);
      setMeta('twitter:description', DEFAULT_DESC);
      setMeta('twitter:image',       DEFAULT_IMAGE);
    };
  }, [title, description, image]);
}
