// Small accessible form shared by editors for numeric and named options.
export function openEditorForm(title,fields,{description=''}={}){
  if(typeof document==='undefined')return Promise.resolve(null);
  return new Promise(resolve=>{
    const focus=document.activeElement,dialog=document.createElement('dialog'),form=document.createElement('form');
    dialog.setAttribute('aria-label',title);dialog.style.cssText='width:min(420px,92vw);max-height:88dvh;overflow:auto;background:#19241f;color:#eef4ed;border:1px solid #53605b;border-radius:12px;padding:18px;font:16px system-ui';
    const heading=document.createElement('h2');heading.textContent=title;form.appendChild(heading);
    if(description){const summary=document.createElement('p');summary.textContent=description;summary.style.whiteSpace='pre-line';form.appendChild(summary);}
    const inputs={};
    for(const field of fields){
      const label=document.createElement('label');label.textContent=field.label;label.style.cssText='display:block;margin:10px 0';
      const input=document.createElement(field.options?'select':field.type==='textarea'?'textarea':'input');input.setAttribute('aria-label',field.label);input.style.cssText='display:block;box-sizing:border-box;width:100%;min-height:44px';
      if(field.options)for(const option of field.options){const item=document.createElement('option');item.value=option.value??option;item.textContent=option.label??option;input.appendChild(item);}
      else if(field.type==='textarea'){input.rows=field.rows||5;}
      else{input.type=field.type||'number';if(input.type==='number')input.step=field.step||'any';}
      if(field.suggestions&&!field.options){const list=document.createElement('datalist');list.id=`editor-options-${field.id}-${Math.random().toString(36).slice(2)}`;for(const value of field.suggestions){const option=document.createElement('option');option.value=value;list.appendChild(option)}input.setAttribute('list',list.id);form.appendChild(list);}
      input.value=field.value??'';
      if(field.type==='color'){
        // Native color controls require RGB hex; preserve an existing CSS/alpha
        // color when the user opens Properties without changing this field.
        const canvas=document.createElement('canvas');canvas.width=canvas.height=1;const context=canvas.getContext('2d');
        context.fillStyle=field.value||'#000000';context.fillRect(0,0,1,1);const rgba=context.getImageData(0,0,1,1).data;
        input.value='#'+Array.from(rgba.slice(0,3),n=>n.toString(16).padStart(2,'0')).join('');
        input.addEventListener('input',()=>{input.dataset.colorChanged='true';});
      }
      if(field.min!==undefined)input.min=field.min;if(field.max!==undefined)input.max=field.max;input.required=field.required??!field.options?.some(option=>(option.value??option)==='');label.appendChild(input);form.appendChild(label);inputs[field.id]={input,field};
    }
    const close=value=>{dialog.close();dialog.remove();focus?.focus?.();resolve(value);};
    const cancel=document.createElement('button');cancel.type='button';cancel.textContent='Cancel';cancel.onclick=()=>close(null);
    const apply=document.createElement('button');apply.type='submit';apply.textContent='Apply';for(const b of [cancel,apply]){b.style.cssText='min-height:44px;padding:8px 20px;margin:12px 8px 0 0';form.appendChild(b);}
    form.onsubmit=event=>{event.preventDefault();close(Object.fromEntries(Object.entries(inputs).map(([id,{input,field}])=>[id,!field.options&&(field.type||'number')==='number'?Number(input.value):field.type==='color'&&!input.dataset.colorChanged?field.value:input.value])));};
    dialog.oncancel=event=>{event.preventDefault();close(null);};for(const name of ['keydown','keyup'])dialog.addEventListener(name,e=>e.stopPropagation());
    dialog.appendChild(form);document.body.appendChild(dialog);dialog.showModal();
  });
}
export function chooseEditorFiles(accept,{multiple=false}={}){
  if(typeof document==='undefined')return Promise.resolve([]);
  return new Promise(resolve=>{const input=document.createElement('input');input.type='file';input.accept=accept;input.multiple=multiple;input.onchange=()=>resolve(Array.from(input.files||[]));input.oncancel=()=>resolve([]);input.click();});
}
