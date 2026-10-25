// Small accessible form shared by editors for numeric and named options.
export function openEditorForm(title,fields,{description='',applyLabel='Apply'}={}){
  if(typeof document==='undefined')return Promise.resolve(null);
  return new Promise(resolve=>{
    const focus=document.activeElement,dialog=document.createElement('dialog'),form=document.createElement('form');
    dialog.setAttribute('aria-label',title);dialog.style.cssText='box-sizing:border-box;width:min(420px,calc(100vw - 24px));max-height:88dvh;overflow:auto;background:#19241f;color:#eef4ed;border:1px solid #53605b;border-radius:12px;padding:18px;font:16px system-ui';
    // Give the modal a neutral initial focus before showModal runs its focus steps.
    // Focusing then blurring an input would still flash the mobile keyboard.
    const heading=document.createElement('h2');heading.tabIndex=-1;heading.autofocus=true;heading.textContent=title;heading.style.cssText='font-size:20px;margin:0 0 12px';form.appendChild(heading);
    if(description){const summary=document.createElement('p');summary.textContent=description;summary.style.whiteSpace='pre-line';form.appendChild(summary);}
    const inputs={},actionFields=[],previews=[],sections=new Map();
    for(const field of fields){
      let parent=form;
      if(field.section){
        const section=typeof field.section==='string'?{label:field.section}:field.section;
        if(!sections.has(section.label)){
          const details=document.createElement('details');details.open=section.open===true;details.style.cssText='border:1px solid #53605b;border-radius:8px;padding:0 10px;margin:10px 0';
          const summary=document.createElement('summary');summary.textContent=section.label;summary.style.cssText='cursor:pointer;min-height:44px;display:list-item;align-content:center;font-weight:700';details.appendChild(summary);
          if(section.description){const help=document.createElement('p');help.textContent=section.description;details.appendChild(help);}
          form.appendChild(details);sections.set(section.label,details);
        }
        parent=sections.get(section.label);
      }
      if(field.type==='preview'){
        const canvas=document.createElement('canvas');canvas.width=320;canvas.height=180;canvas.setAttribute('aria-label',field.label);canvas.setAttribute('role','img');canvas.style.cssText='width:100%;height:auto;display:block;background:#101818;border-radius:6px';if(field.sticky)canvas.style.cssText+=';position:sticky;top:0;z-index:2;box-shadow:0 2px 8px #0008';parent.appendChild(canvas);previews.push({canvas,field});
        if(field.onPointer){
          canvas.style.touchAction='none';canvas.style.cursor='crosshair';
          const update=event=>{const r=canvas.getBoundingClientRect();const patch=field.onPointer({x:(event.clientX-r.left)*canvas.width/r.width,y:(event.clientY-r.top)*canvas.height/r.height},values(),canvas)||{};for(const [id,value] of Object.entries(patch)){const entry=inputs[id];if(entry)entry.input.value=value;}refresh();};
          canvas.addEventListener('pointerdown',event=>{canvas.setPointerCapture(event.pointerId);update(event);});
          canvas.addEventListener('pointermove',event=>{if(canvas.hasPointerCapture(event.pointerId))update(event);});
          canvas.addEventListener('pointerup',event=>{if(canvas.hasPointerCapture(event.pointerId)){update(event);canvas.releasePointerCapture(event.pointerId);}});
        }
        continue;
      }
      if(field.type==='button'){
        const button=document.createElement('button');button.type='button';button.textContent=field.label;button.style.cssText='min-height:44px;width:100%;margin:10px 0';
        button.onclick=async()=>{button.disabled=true;dialog.close();try{const updates=await field.onClick?.(values());refresh();for(const [id,value] of Object.entries(updates||{})){const entry=inputs[id];if(!entry)continue;if(entry.field.type==='checkbox')entry.input.checked=Boolean(value);else entry.input.value=value;if(entry.field.type==='color')entry.input.dataset.colorChanged='true';}refresh();}catch(error){button.textContent=field.label+' — '+error.message;}finally{button.disabled=false;if(dialog.isConnected){dialog.showModal();heading.focus({preventScroll:true});}}};
        parent.appendChild(button);actionFields.push({button,field});continue;
      }
      const label=document.createElement('label');label.textContent=typeof field.label==='function'?field.label({}):field.label;label.style.cssText='display:block;margin:10px 0';
      const input=document.createElement(field.options?'select':field.type==='textarea'?'textarea':'input');input.setAttribute('aria-label',typeof field.label==='function'?field.label({}):field.label);input.style.cssText='display:block;box-sizing:border-box;width:100%;min-height:44px';
      if(field.options)for(const option of (typeof field.options==='function'?field.options({}):field.options)){const item=document.createElement('option');item.value=option.value??option;item.textContent=option.label??option;input.appendChild(item);}
      else if(field.type==='textarea'){input.rows=field.rows||5;if(Number.isInteger(field.maxLength)&&field.maxLength>=0)input.maxLength=field.maxLength;}
      else{input.type=field.type||'number';if(input.type==='number')input.step=field.step||'any';if(input.type==='range'){input.min=field.min??0;input.max=field.max??1;input.step=field.step??.01;}}
      if(field.suggestions&&!field.options){const list=document.createElement('datalist');list.id=`editor-options-${field.id}-${Math.random().toString(36).slice(2)}`;for(const value of field.suggestions){const option=document.createElement('option');option.value=value;list.appendChild(option)}input.setAttribute('list',list.id);form.appendChild(list);}
      input.value=field.value??'';if(field.readOnly)input.readOnly=true;
      if(field.type==='checkbox'){input.checked=Boolean(field.value);input.style.cssText='width:24px;height:24px;min-height:24px;vertical-align:middle;margin-left:12px';}
      if(field.type==='color'){
        // Native color controls require RGB hex; preserve an existing CSS/alpha
        // color when the user opens Properties without changing this field.
        const canvas=document.createElement('canvas');canvas.width=canvas.height=1;const context=canvas.getContext('2d');
        context.fillStyle=field.value||'#000000';context.fillRect(0,0,1,1);const rgba=context.getImageData(0,0,1,1).data;
        input.value='#'+Array.from(rgba.slice(0,3),n=>n.toString(16).padStart(2,'0')).join('');
        input.addEventListener('input',()=>{input.dataset.colorChanged='true';});
      }
      if(field.min!==undefined)input.min=field.min;if(field.max!==undefined)input.max=field.max;input.required=field.type==='checkbox'?false:field.required??!(Array.isArray(field.options)&&field.options.some(option=>(option.value??option)===''));let output=null;if(field.type==='range'){output=document.createElement('output');output.style.cssText='float:right;font-variant-numeric:tabular-nums';label.appendChild(output);}label.appendChild(input);parent.appendChild(label);inputs[field.id]={input,field,label,output};
    }
    const values=()=>Object.fromEntries(Object.entries(inputs).map(([id,{input,field}])=>[id,field.type==='checkbox'?input.checked:input.value]));
    const refresh=()=>{
      const current=values();for(const {canvas,field} of previews){canvas.hidden=field.visibleWhen?!field.visibleWhen(current):false;if(!canvas.hidden)field.render(canvas,current);}
      for(const {button,field} of actionFields){button.hidden=field.visibleWhen?!field.visibleWhen(current):false;}
      for(const {input,field,label,output} of Object.values(inputs)){
        if(output)output.textContent=field.format?field.format(Number(input.value)):String(Number(Number(input.value).toFixed(3)));
        const state=values();
        label.hidden=field.visibleWhen?!field.visibleWhen(state):false;
        label.style.display=label.hidden?'none':'block';
        input.disabled=label.hidden;
        if(typeof field.options==='function'){
          const selected=input.value,options=field.options(state);input.replaceChildren();
          for(const entry of options){const option=document.createElement('option');option.value=entry.value??entry;option.textContent=entry.label??entry;input.appendChild(option);}
          if(options.some(entry=>(entry.value??entry)===selected))input.value=selected;
        }
        if(typeof field.label==='function'){label.firstChild.textContent=field.label(state);input.setAttribute('aria-label',field.label(state));}
      }
      for(const details of sections.values())details.hidden=![...details.querySelectorAll('label,button,canvas')].some(el=>!el.hidden);
    };
    // Invalid controls in collapsed sections must be exposed for browser focus.
    form.addEventListener('invalid',event=>{const details=event.target.closest?.('details');if(details)details.open=true;},true);
    for(const {input,field} of Object.values(inputs)){input.addEventListener('change',refresh);if(previews.length||field.type==='range')input.addEventListener('input',()=>{const patch=field.onInput?.(values())||{};for(const [id,value] of Object.entries(patch)){const entry=inputs[id];if(entry){if(entry.field.type==='checkbox')entry.input.checked=Boolean(value);else entry.input.value=value;}}refresh();});}
    refresh();
    let animationFrame=0;
    const close=value=>{if(animationFrame)cancelAnimationFrame(animationFrame);dialog.close();dialog.remove();focus?.focus?.();resolve(value);};
    const cancel=document.createElement('button');cancel.type='button';cancel.textContent='Cancel';cancel.onclick=()=>close(null);
    const apply=document.createElement('button');apply.type='submit';apply.textContent=applyLabel;for(const b of [cancel,apply]){b.style.cssText='min-height:44px;padding:8px 20px;margin:12px 8px 0 0';form.appendChild(b);}
    form.onsubmit=event=>{event.preventDefault();close(Object.fromEntries(Object.entries(inputs).map(([id,{input,field}])=>[id,field.type==='checkbox'?input.checked:!field.options&&['number','range'].includes(field.type||'number')?Number(input.value):field.type==='color'&&!input.dataset.colorChanged?field.value:input.value])));};
    dialog.oncancel=event=>{event.preventDefault();close(null);};for(const name of ['keydown','keyup'])dialog.addEventListener(name,e=>e.stopPropagation());
    dialog.appendChild(form);document.body.appendChild(dialog);dialog.showModal();
    if(previews.some(p=>p.field.animated)){
      let last=0;const animate=time=>{if(!dialog.isConnected)return;if(dialog.open&&time-last>=33){last=time;const state=values();for(const {canvas,field} of previews)if(field.animated&&!canvas.hidden&&(!canvas.closest('details')||canvas.closest('details').open))field.render(canvas,state);}animationFrame=requestAnimationFrame(animate);};
      animationFrame=requestAnimationFrame(animate);
    }
    // A canvas pointer-down can open this before the browser finishes focusing
    // the original tap target. Restore neutral focus only if it left the modal.
    requestAnimationFrame(()=>{if(dialog.open&&!dialog.contains(document.activeElement))heading.focus({preventScroll:true});});
  });
}
export function chooseEditorFiles(accept,{multiple=false}={}){
  if(typeof document==='undefined')return Promise.resolve([]);
  return new Promise(resolve=>{const input=document.createElement('input');input.type='file';input.accept=accept;input.multiple=multiple;input.onchange=()=>resolve(Array.from(input.files||[]));input.oncancel=()=>resolve([]);input.click();});
}
