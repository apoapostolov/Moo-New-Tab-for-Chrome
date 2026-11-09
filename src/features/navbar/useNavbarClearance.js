import { useLayoutEffect, useState } from 'react';

export default function useNavbarClearance() {
  const [node, setNode] = useState(null);
  useLayoutEffect(() => {
    if (!node) return undefined;
    const root = document.documentElement;
    let rail;
    const measure = () => {
      const current = document.querySelector('.widgetRail-top-right');
      if (current !== rail) {
        if (rail) observer.unobserve(rail);
        rail = current;
        if (rail) observer.observe(rail);
      }
      root.style.setProperty('--navbar-height', `${node.getBoundingClientRect().height}px`);
      if (rail?.children.length) {
        root.style.setProperty('--upper-right-bottom', `${rail.getBoundingClientRect().bottom}px`);
      } else {
        root.style.removeProperty('--upper-right-bottom');
      }
    };
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    const mutations = new window.MutationObserver(measure);
    mutations.observe(document.getElementById('center'), { childList: true, subtree: true });
    measure();
    window.addEventListener('resize', measure);
    return () => {
      observer.disconnect();
      mutations.disconnect();
      window.removeEventListener('resize', measure);
      root.style.removeProperty('--navbar-height');
      root.style.removeProperty('--upper-right-bottom');
    };
  }, [node]);
  return setNode;
}
