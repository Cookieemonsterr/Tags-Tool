javascript:(function(){
if(window.__saturnTagsListenerActive){alert("Listener already active ✅");return;}
window.__saturnTagsListenerActive=true;

const TAB_ID = (()=>{try{let id=sessionStorage.getItem('__SAT_TAB_ID');if(!id){id=(Date.now()+"-"+Math.random().toString(36).slice(2));sessionStorage.setItem('__SAT_TAB_ID',id);}return id;}catch(_){return Date.now()+"-"+Math.random().toString(36).slice(2);}})();
const CH='saturn-tags-channel', LS_KEY='__SATURN_TAGS_JOBS__';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const norm=s=>(s||"").replace(/\s+/g," ").trim();
const equals=(a,b)=>norm(a)===norm(b);

// --- AntD exact-typing runner (same as before, tuned) ---
async function addTagsExact(tags,{perKeyDelay=90,postTypeWait=450,openWait=120}={}){
  const overflow=document.querySelector('.ant-select-selection-overflow');
  if(!overflow){console.warn("Tags select not found");return {added:0,skipped:tags.length};}
  const selectRoot=overflow.closest('.ant-select');
  const selector=selectRoot?.querySelector('.ant-select-selector')||selectRoot;
  const searchInput=selectRoot?.querySelector('.ant-select-selection-search-input');
  if(!selectRoot||!selector||!searchInput){console.warn("AntD elements missing");return {added:0,skipped:tags.length};}
  const setNative=(el,val)=>{const p=Object.getPrototypeOf(el);const d=Object.getOwnPropertyDescriptor(p,'value');d&&d.set?d.set.call(el,val):el.value=val;};
  const openDropdown=()=>{selector.dispatchEvent(new MouseEvent('mousedown',{bubbles:true}));selector.click();};
  async function ensureOpen(){openDropdown();for(let i=0;i<20;i++){const dd=document.querySelector('.ant-select-dropdown:not(.ant-select-dropdown-hidden)');if(dd)return dd;await sleep(openWait);}return null;}
  function prepInput(){searchInput.removeAttribute('readonly');searchInput.style.opacity='1';searchInput.focus();}
  async function clearInput(){prepInput();setNative(searchInput,'');searchInput.dispatchEvent(new Event('input',{bubbles:true}));await sleep(120);}
  async function typeLikeHuman(text){prepInput();await clearInput();for(const ch of text.split('')){searchInput.dispatchEvent(new KeyboardEvent('keydown',{bubbles:true,key:ch,code:ch}));setNative(searchInput,searchInput.value+ch);searchInput.dispatchEvent(new Event('input',{bubbles:true}));searchInput.dispatchEvent(new KeyboardEvent('keyup',{bubbles:true,key:ch,code:ch}));await sleep(perKeyDelay);}searchInput.dispatchEvent(new KeyboardEvent('keydown',{bubbles:true,key:'ArrowDown',code:'ArrowDown'}));}
  async function waitForExact(tag){for(let i=0;i<18;i++){const dd=document.querySelector('.ant-select-dropdown:not(.ant-select-dropdown-hidden)');if(dd){const items=[...dd.querySelectorAll('.ant-select-item-option-content')];const hit=items.find(c=>{const main=c.querySelector('div');return main&&equals(main.textContent,tag);});if(hit) return hit.closest('.ant-select-item');}await sleep(110);}return null;}
  function clickTagAction(li){const action=[...li.querySelectorAll('a,button,div,span')].find(el=>/^tag$/i.test((el.textContent||'').trim())); if(action){action.dispatchEvent(new MouseEvent('mousedown',{bubbles:true}));action.click();}else{li.dispatchEvent(new MouseEvent('mousedown',{bubbles:true}));li.click();}}
  let added=0,skipped=0;
  for(const t of tags){const dd=await ensureOpen();if(!dd){skipped++;continue;}await typeLikeHuman(t);const li=await waitForExact(t);if(!li){console.warn('No exact match:',t);await clearInput();skipped++;continue;}clickTagAction(li);await sleep(postTypeWait);await clearInput();added++;}
  document.body.click();return {added,skipped};
}

// --- Job claim & run ---
async function claimAndRun(payload){
  const {jobs, perKeyDelay, postTypeWait, openWait}=payload||{};
  if(!Array.isArray(jobs)||!jobs.length) return;

  // atomic-ish claim via localStorage
  for(let tries=0;tries<30;tries++){
    let state; try{state=JSON.parse(localStorage.getItem(LS_KEY)||'{}');}catch(_){state={};}
    if(!state.jobs) state.jobs=[];
    // find first pending
    const idx=state.jobs.findIndex(j=>!j.status||j.status==='pending');
    if(idx===-1){console.log('[Tags] No pending jobs.');return;}
    // claim
    if(state.jobs[idx].status==='pending' || !state.jobs[idx].status){
      state.jobs[idx].status='claimed';
      state.jobs[idx].claimed_by=TAB_ID;
      state.jobs[idx].claimed_at=Date.now();
      try{
        localStorage.setItem(LS_KEY, JSON.stringify(state));
        // we "own" this job now
        const job=state.jobs[idx];
        const label=job.label||('Job #'+(idx+1));
        const tags=job.tags||[];
        console.log('[Tags] Running',label,tags);
        try{
          const res=await addTagsExact(tags,{perKeyDelay,postTypeWait,openWait});
          // mark done
          let st2; try{st2=JSON.parse(localStorage.getItem(LS_KEY)||'{}');}catch(_){st2={};}
          if(st2.jobs && st2.jobs[idx]){st2.jobs[idx].status='done';st2.jobs[idx].finished_at=Date.now();localStorage.setItem(LS_KEY,JSON.stringify(st2));}
          alert(`✅ ${label}\nAdded: ${res.added} • Skipped: ${res.skipped}`);
        }catch(e){
          let st3; try{st3=JSON.parse(localStorage.getItem(LS_KEY)||'{}');}catch(_){st3={};}
          if(st3.jobs && st3.jobs[idx]){st3.jobs[idx].status='error';st3.jobs[idx].error=String(e);}
          localStorage.setItem(LS_KEY,JSON.stringify(st3));
          alert(`❌ ${label} failed: `+e);
        }
        return;
      }catch(e){ await sleep(60); /* contention; retry */ }
    }else{
      await sleep(60);
    }
  }
}

// Channel setup
let bc=null, useLS=false; try{bc=new BroadcastChannel(CH);}catch(_){useLS=true;}
function onMsg(msg){ if(msg && msg.type==='SATURN_TAGS_JOBS' && msg.payload){ claimAndRun(msg.payload); } }
if(!useLS){ bc.onmessage=(e)=>onMsg(e.data); } else {
  window.addEventListener('storage',(ev)=>{ if(ev.key==='__SATURN_TAGS_BCAST__' && ev.newValue){ try{const m=JSON.parse(ev.newValue); onMsg(m);}catch(_){}} });
}
alert('👂 Listener armed.\nThis tab will claim the next job when you send them.');
})();
