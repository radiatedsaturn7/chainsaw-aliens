// Shared focus treatment for artwork and text, without changing hit bounds.
export function menuControlFilter(selected,enabled=true){
 return !enabled?'grayscale(1) brightness(0.5)':selected?'none':'brightness(0.55)';
}
