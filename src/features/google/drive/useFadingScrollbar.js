import { useEffect } from 'react';

export default function useFadingScrollbar(ref) {
  useEffect(() => {
    const node = ref.current;
    let timer;
    const scrolling = () => {
      node.classList.add('driveScrolling');
      clearTimeout(timer);
      timer = setTimeout(() => node.classList.remove('driveScrolling'), 900);
    };
    const focused = () =>
      node.classList.toggle(
        'driveFocused',
        document.hasFocus() && node.contains(document.activeElement),
      );
    const blurred = () => node.classList.remove('driveFocused');
    node.addEventListener('scroll', scrolling, { passive: true });
    node.addEventListener('wheel', scrolling, { passive: true });
    node.addEventListener('focusin', focused);
    node.addEventListener('focusout', focused);
    window.addEventListener('focus', focused);
    window.addEventListener('blur', blurred);
    return () => {
      clearTimeout(timer);
      node.removeEventListener('scroll', scrolling);
      node.removeEventListener('wheel', scrolling);
      node.removeEventListener('focusin', focused);
      node.removeEventListener('focusout', focused);
      window.removeEventListener('focus', focused);
      window.removeEventListener('blur', blurred);
    };
  }, [ref]);
}
