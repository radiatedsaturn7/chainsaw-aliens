// Touch scrolling must not move a range thumb. Only a deliberate horizontal
// drag edits it; mouse and keyboard retain native range behavior.
export function protectRangeTouchScroll(input) {
  input.style.touchAction = 'pan-y';
  let gesture = null, dispatching = false;
  const setValue = value => {
    input.value = value;
    dispatching = true;
    input.dispatchEvent(new Event('input', {bubbles:true}));
    dispatching = false;
  };
  input.addEventListener('pointerdown', event => {
    if (event.pointerType !== 'touch') return;
    gesture = {id:event.pointerId,x:event.clientX,y:event.clientY,value:input.value,axis:null};
    event.preventDefault();
    input.setPointerCapture?.(event.pointerId);
  });
  input.addEventListener('pointermove', event => {
    if (!gesture || gesture.id !== event.pointerId) return;
    const dx=event.clientX-gesture.x,dy=event.clientY-gesture.y;
    if (!gesture.axis && Math.max(Math.abs(dx),Math.abs(dy))>=8) gesture.axis=Math.abs(dx)>Math.abs(dy)?'x':'y';
    if (gesture.axis !== 'x') return;
    event.preventDefault();
    const min=Number(input.min),max=Number(input.max),step=Number(input.step)||.01;
    const value=Number(gesture.value)+dx/Math.max(1,input.getBoundingClientRect().width)*(max-min);
    setValue(Math.max(min,Math.min(max,min+Math.round((value-min)/step)*step)));
  });
  // Suppress any native thumb movement while our touch gesture is active.
  let acceptedValue=input.value;
  input.addEventListener('input', event => {
    if (gesture && !dispatching) {input.value=gesture.axis==='x'?acceptedValue:gesture.value;event.stopImmediatePropagation();return;}
    acceptedValue=input.value;
  },true);
  const end=event=>{if(gesture?.id===event.pointerId){event.preventDefault();if(gesture.axis!=='x')input.value=gesture.value;gesture=null;}};
  input.addEventListener('pointerup',end);
  input.addEventListener('pointercancel',end);
}
