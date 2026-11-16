/** Move overlays outside page stacking contexts and overflow containers.
 * Svelte retains ownership of the node; removing the component removes it.
 */
export function portal(node: HTMLElement) {
  document.body.appendChild(node);
  return {
    destroy() {
      node.remove();
    }
  };
}
