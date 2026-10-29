export const measure=`(()=>{
 const entries={};
 for(const el of document.querySelectorAll('[data-entry],.job:not([data-entry])')){
  if(!el.checkVisibility({visibilityProperty:true}))continue;const bounds=el.getBoundingClientRect();if(!bounds.width||!bounds.height)continue;
  const rs=[],walker=document.createTreeWalker(el,NodeFilter.SHOW_TEXT);
  while(walker.nextNode()){
   const n=walker.currentNode;if(!n.textContent.trim())continue;
   let visible=true;for(let a=n.parentElement;a&&a!==el.parentElement;a=a.parentElement){const c=getComputedStyle(a);if(c.visibility==='hidden'||Number(c.opacity)===0||(!a.checkVisibility()&&c.display!=='contents')){visible=false;break;}}
   if(!visible)continue;const r=document.createRange();r.selectNodeContents(n);
   for(const q of r.getClientRects())if(q.width>.5&&q.height>.5){let box={left:q.left,right:q.right,top:q.top,bottom:q.bottom,width:q.width,height:q.height};for(let a=n.parentElement;a&&a!==el.parentElement;a=a.parentElement){const c=getComputedStyle(a);if(c.overflow!=='visible'||c.overflowX!=='visible'||c.overflowY!=='visible'){const z=a.getBoundingClientRect();box.left=Math.max(box.left,z.left);box.right=Math.min(box.right,z.right);box.top=Math.max(box.top,z.top);box.bottom=Math.min(box.bottom,z.bottom);}}box.width=box.right-box.left;box.height=box.bottom-box.top;if(box.width>.5&&box.height>.5)rs.push(box);}
  }
  for(const svg of el.querySelectorAll('svg'))if(svg.checkVisibility({visibilityProperty:true,opacityProperty:true})){const q=svg.getBoundingClientRect();if(q.width&&q.height)rs.push(q);}
  let gap=0;for(const r of rs){const line=rs.filter(q=>Math.min(r.bottom,q.bottom)-Math.max(r.top,q.top)>Math.min(r.height,q.height)*.5).sort((a,b)=>a.left-b.left);let reach=line[0].right;for(const q of line.slice(1)){gap=Math.max(gap,q.left-reach);reach=Math.max(reach,q.right);}}
  const type=el.dataset.entry||'card',o=entries[type]??={count:0,maxGap:0,maxTrail:0,maxWidth:0,worst:null};o.count++;if(gap>o.maxGap){o.maxGap=gap;o.worst=el.textContent.slice(0,170);}o.maxTrail=Math.max(o.maxTrail,bounds.right-Math.max(...rs.map(r=>r.right)));o.maxWidth=Math.max(o.maxWidth,bounds.width);
 }
 const header=[...document.querySelectorAll('.topbar [data-settings-slot]>button,.topbar .phone-menu>summary')].filter(e=>e.checkVisibility()).map(e=>{const r=e.getBoundingClientRect();return {label:e.getAttribute('aria-label'),x:r.x,y:r.y,w:r.width,h:r.height,right:r.right};});
 return {width:innerWidth,scrollWidth:document.documentElement.scrollWidth,overflow:document.documentElement.scrollWidth-innerWidth,entries,header,stages:[...document.querySelectorAll('.pipeline-stage')].map(e=>e.dataset.stage)};
})()`;
