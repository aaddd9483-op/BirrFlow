(() => {
  'use strict';
  // Keep the existing storage keys so renaming the app preserves saved records and theme.
  const KEY='daymark-income-v1', THEME='daymark-theme-v1', SECURITY_KEY='all-money-in-security-v1', DAILY_NOTES_KEY='all-money-in-daily-notes-v1';

  const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
  const dailyQuotes=[
    'Small steps today can build something remarkable tomorrow.',
    'You are closer than you were yesterday. Keep showing up.',
    'Progress grows when patience meets consistent effort.',
    'Every skill you practice is an investment in your future.',
    'Start where you are. Make the next good move.',
    'Your next opportunity might begin with today’s effort.',
    'Give your goals the same attention you give your doubts.',
    'A little progress is still progress. Let it count.',
    'Keep learning, keep building, keep believing in the work.',
    'You do not need a perfect plan to take a meaningful step.',
    'Good things grow from the work nobody sees yet.',
    'Be proud of the effort you put in before the results arrive.',
    'Make today a small beginning your future self will thank you for.',
    'Consistency turns an ordinary day into forward momentum.',
    'Your ambition deserves a place on today’s calendar.',
    'Keep creating value. The rest can grow from there.',
    'One focused hour can change the direction of your week.',
    'Every new day gives your plans another chance to take root.',
    'Trust the process you are building one day at a time.',
    'You can move forward without having every answer.',
    'The work you do today is a gift to tomorrow.',
    'Your pace is yours. Keep taking the next step.',
    'Small wins are proof that your effort is becoming real.',
    'Show up for the idea you cannot stop thinking about.',
    'Build patiently. Meaningful things take the time they take.',
    'Every day you try, you give possibility room to grow.',
    'Keep your eyes on what you can make happen today.',
    'Let curiosity lead you toward your next opportunity.',
    'You have made it through every hard day so far. Keep going.',
    'A thoughtful next step is more powerful than a perfect someday.',
    'Your future is shaped by the small choices you make today.'
  ];
  const localISO=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const parseDay=s=>{const [y,m,d]=s.split('-').map(Number);return new Date(y,m-1,d,12)};
  const todayISO=()=>localISO(new Date());
  const pretty=(s,opts={month:'short',day:'numeric',year:'numeric'})=>parseDay(s).toLocaleDateString(undefined,opts);
  const money=n=>`${new Intl.NumberFormat('en-US',{maximumFractionDigits:2}).format(n)} ETB`;
  let records=load(), securityConfig=loadSecurity(), dailyNotes=loadDailyNotes();
  let activePage='dashboard', selectedDate=todayISO(), calendarDate=new Date(), calendarView='calendar', chartRange=7, chartMode='daily', historyFilter='all', customRange=null, toastTimer, locked=false, lockTimer=null, lastActivity=Date.now();
  function load(){try{const v=JSON.parse(localStorage.getItem(KEY)||'[]');return Array.isArray(v)?v.filter(r=>r&&/^\d{4}-\d\d-\d\d$/.test(r.date)&&Number.isFinite(+r.amount)&&+r.amount>=0).map(r=>({id:String(r.id||crypto.randomUUID()),date:r.date,amount:+r.amount,note:String(r.note||'')})):[]}catch{return[]}}
  function loadDailyNotes(){try{const v=JSON.parse(localStorage.getItem(DAILY_NOTES_KEY)||'{}');if(!v||typeof v!=='object'||Array.isArray(v))return{};return Object.fromEntries(Object.entries(v).filter(([date,note])=>/^\d{4}-\d\d-\d\d$/.test(date)&&typeof note==='string'&&note.length<=500))}catch{return{}}}
  function loadSecurity(){try{const v=JSON.parse(localStorage.getItem(SECURITY_KEY)||'null');return v&&typeof v.salt==='string'&&typeof v.hash==='string'?{salt:v.salt,hash:v.hash,timeout:[1,5,15,30].includes(Number(v.timeout))?Number(v.timeout):5}:null}catch{return null}}
  function persist(){localStorage.setItem(KEY,JSON.stringify(records))}
  function sum(rows){return rows.reduce((a,r)=>a+r.amount,0)}
  function byDay(){const map=new Map();records.forEach(r=>map.set(r.date,(map.get(r.date)||0)+r.amount));return map}
  function currentWeek(){const d=new Date();d.setHours(12,0,0,0);const back=(d.getDay()+6)%7;d.setDate(d.getDate()-back);const start=localISO(d);d.setDate(d.getDate()+6);return[start,localISO(d)]}
  function inRange(date,start,end){return date>=start&&date<=end}
  function lastDays(n,end=todayISO()){let d=parseDay(end);const out=[];for(let i=n-1;i>=0;i--){const x=new Date(d);x.setDate(x.getDate()-i);out.push(localISO(x))}return out}
  function toast(msg){const el=$('#toast');el.textContent=msg;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),2500)}
  function updateDailyQuote(){const now=new Date(),dayNumber=Math.floor(Date.UTC(now.getFullYear(),now.getMonth(),now.getDate())/86400000),quoteIndex=((dayNumber%dailyQuotes.length)+dailyQuotes.length)%dailyQuotes.length;$('#daily-quote-text').textContent=`“${dailyQuotes[quoteIndex]}”`;$('#quote-index').textContent=String(quoteIndex+1).padStart(2,'0')}
  function scheduleQuoteRefresh(){const now=new Date(),tomorrow=new Date(now.getFullYear(),now.getMonth(),now.getDate()+1);setTimeout(()=>{updateDailyQuote();scheduleQuoteRefresh()},tomorrow.getTime()-now.getTime()+1000)}
  function setPage(name){activePage=name;$$('.page').forEach(p=>p.classList.toggle('active',p.id===`page-${name}`));$$('.nav-link[data-page]').forEach(b=>b.classList.toggle('active',b.dataset.page===name));$('#breadcrumb-current').textContent={dashboard:'Overview',history:'Income history',calendar:'Calendar',settings:'Privacy & security'}[name];if(name==='history')renderHistory();if(name==='calendar')renderCalendar();if(name==='settings')renderSettings();window.scrollTo({top:0,behavior:'smooth'})}
  function renderSettings(){
    const enabled=!!securityConfig;$('#lock-status').textContent=enabled?'On':'Off';$('#lock-status').classList.toggle('enabled',enabled);
    $('#pin-setup-form').hidden=enabled;$('#lock-enabled-controls').hidden=!enabled;
    if(enabled)$('#lock-timeout').value=String(securityConfig.timeout);
  }
  function toBase64(bytes){let binary='';bytes.forEach(b=>binary+=String.fromCharCode(b));return btoa(binary)}
  function fromBase64(value){return Uint8Array.from(atob(value),c=>c.charCodeAt(0))}
  async function hashPin(pin,salt){
    if(!globalThis.crypto?.subtle)throw new Error('Secure PIN hashing is unavailable in this browser. Open the app at localhost and try again.');
    const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(pin),'PBKDF2',false,['deriveBits']);
    const bits=await crypto.subtle.deriveBits({name:'PBKDF2',salt,iterations:250000,hash:'SHA-256'},key,256);
    return toBase64(new Uint8Array(bits));
  }
  async function makeSecurityConfig(pin,timeout=5){const salt=crypto.getRandomValues(new Uint8Array(16));return{salt:toBase64(salt),hash:await hashPin(pin,salt),timeout:Number(timeout)}}
  function equalHash(a,b){if(a.length!==b.length)return false;let diff=0;for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);return diff===0}
  async function savePin(e,change=false){
    e.preventDefault();const first=$(change?'#pin-change-new':'#pin-new').value,confirmPin=$(change?'#pin-change-confirm':'#pin-confirm').value,message=$(change?'#pin-change-message':'#pin-setup-message');
    message.textContent='';if(!/^\d{4,12}$/.test(first)){message.textContent='Use a PIN with 4 to 12 digits.';return}if(first!==confirmPin){message.textContent='The PINs do not match.';return}
    try{securityConfig=await makeSecurityConfig(first,securityConfig?.timeout||5);localStorage.setItem(SECURITY_KEY,JSON.stringify(securityConfig));e.target.reset();renderSettings();lastActivity=Date.now();startIdleTimer();toast(change?'PIN updated':'App lock enabled')}catch(error){message.textContent=error.message||'Could not set up the app lock.'}
  }
  function startIdleTimer(){clearTimeout(lockTimer);if(!securityConfig||locked)return;lockTimer=setTimeout(lockNow,securityConfig.timeout*60*1000)}
  function lockNow(){if(!securityConfig)return;clearTimeout(lockTimer);locked=true;document.querySelector('.app-shell').inert=true;$('#app-lock-overlay').hidden=false;$('#unlock-message').textContent='';setTimeout(()=>$('#unlock-pin').focus(),50)}
  function unlockApp(){locked=false;document.querySelector('.app-shell').inert=false;$('#app-lock-overlay').hidden=true;$('#unlock-form').reset();$('#unlock-message').textContent='';lastActivity=Date.now();startIdleTimer()}
  function tinySpark(values,color='#839ea9'){const max=Math.max(1,...values),pts=values.map((v,i)=>`${i*100/(Math.max(1,values.length-1))},${26-v/max*23}`).join(' ');return `<svg viewBox="0 0 100 28" preserveAspectRatio="none"><polyline points="${pts}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`}
  function renderDashboard(){const today=todayISO(),[ws,we]=currentWeek(),month=today.slice(0,7),dmap=byDay();const total=sum(records),todayTotal=sum(records.filter(r=>r.date===today)),weekRows=records.filter(r=>inRange(r.date,ws,we)),monthRows=records.filter(r=>r.date.startsWith(month)),earning=[...dmap.values()].filter(v=>v>0),best=Math.max(0,...dmap.values()),bestDay=best?([...dmap].filter(([,v])=>v===best).map(([d])=>d).sort().at(-1)):null;
    $('#today-label').textContent=new Date().toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric'}).toUpperCase();
    $('#stat-today').innerHTML=`${money(todayTotal).replace(' ETB','')} <small>ETB</small>`;$('#today-note').textContent=todayTotal?`${records.filter(r=>r.date===today).length} ${records.filter(r=>r.date===today).length===1?'entry':'entries'} recorded`:'A fresh day to earn';
    $('#stat-week').innerHTML=`${money(sum(weekRows)).replace(' ETB','')} <small>ETB</small>`;$('#week-range').textContent=`${pretty(ws,{month:'short',day:'numeric'}).toUpperCase()} — ${pretty(we,{month:'short',day:'numeric'}).toUpperCase()}`;$('#week-note').textContent=`${weekRows.length} ${weekRows.length===1?'entry':'entries'} this week`;
    $('#stat-month').innerHTML=`${money(sum(monthRows)).replace(' ETB','')} <small>ETB</small>`;$('#month-note').textContent=new Date().toLocaleDateString(undefined,{month:'long',year:'numeric'});
    $('#stat-total').innerHTML=`${money(total).replace(' ETB','')} <small>ETB</small>`;$('#total-note').textContent=`${records.length} ${records.length===1?'record':'records'} saved`;
    $('#week-bars').innerHTML=Array.from({length:7},(_,i)=>{const d=parseDay(ws);d.setDate(d.getDate()+i);const v=dmap.get(localISO(d))||0,max=Math.max(1,...Array.from({length:7},(_,j)=>{const x=parseDay(ws);x.setDate(x.getDate()+j);return dmap.get(localISO(x))||0}));return `<i title="${['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][i]}: ${money(v)}" style="height:${Math.max(4,22*v/max)}px"></i>`}).join('');
    const monthDays=lastDays(14);$('#month-spark').innerHTML=tinySpark(monthDays.map(d=>dmap.get(d)||0),'#a3b5bd');$('#today-spark').innerHTML=tinySpark(lastDays(7).map(d=>dmap.get(d)||0),'#7fa181');
    $('#best-day').textContent=best?money(best):'—';$('#best-date').textContent=bestDay?pretty(bestDay):'No income recorded yet';$('#average-income').textContent=earning.length?money(total/earning.length):money(0);$('#earning-count').textContent=`Across ${earning.length} earning ${earning.length===1?'day':'days'}`;$('#zero-count').textContent=`${[...dmap.values()].filter(v=>v===0).length} zero-income days recorded`;
    renderChart();renderWeekdayStats();renderRecent();
  }
  function renderWeekdayStats(){
    const today=todayISO(),daily=byDay(),weekdayTotals=Array.from({length:7},()=>({days:0}));
    for(const [date,amount] of daily){if(amount<=0)continue;const weekday=parseDay(date).getDay();weekdayTotals[weekday].days++}
    const mondayFirst=[1,2,3,4,5,6,0],ordered=mondayFirst.map(weekday=>({weekday,days:weekdayTotals[weekday].days})).sort((a,b)=>b.days-a.days||mondayFirst.indexOf(a.weekday)-mondayFirst.indexOf(b.weekday));
    let previousCount=null,rank=0;const ranking=ordered.map((item,index)=>{if(item.days>0&&item.days!==previousCount){rank=index+1;previousCount=item.days}return{...item,rank:item.days?rank:'–'}}),max=Math.max(0,...ranking.map(x=>x.days));
    $('#weekday-list').innerHTML=ranking.map(item=>{
      const name=new Date(2024,0,7+item.weekday,12).toLocaleDateString(undefined,{weekday:'long'});
      return `<div class="weekday-row"><span class="weekday-rank">${item.rank==='–'?'–':`#${item.rank}`}</span><strong class="weekday-name">${name}</strong><span class="weekday-bar"><i style="width:${max?item.days/max*100:0}%"></i></span><strong class="weekday-count">${item.days} ${item.days===1?'day':'days'}</strong></div>`;
    }).join('');
    const earned=[...daily].filter(([date,amount])=>date<=today&&amount>0).map(([date])=>date).sort();
    const earnedSet=new Set(earned);let current=0,anchor=today;
    if(!earnedSet.has(anchor)){const yesterday=parseDay(today);yesterday.setDate(yesterday.getDate()-1);anchor=earnedSet.has(localISO(yesterday))?localISO(yesterday):null}
    if(anchor){let d=parseDay(anchor);while(earnedSet.has(localISO(d))){current++;d.setDate(d.getDate()-1)}}
    let longest=0,run=0,previous=null;
    for(const date of earned){if(previous){const next=parseDay(previous);next.setDate(next.getDate()+1);run=localISO(next)===date?run+1:1}else run=1;longest=Math.max(longest,run);previous=date}
    $('#current-streak').textContent=`${current} ${current===1?'day':'days'}`;$('#longest-streak').textContent=`${longest} ${longest===1?'day':'days'}`;
  }
  function renderChart(){
    const map=byDay(),today=todayISO();let buckets=[];
    if(chartMode==='daily'){
      buckets=lastDays(chartRange).map(d=>({key:d,label:pretty(d,{month:'short',day:'numeric'}),value:map.get(d)||0}));
    }else if(chartMode==='weekly'){
      const count=chartRange===7?8:chartRange===30?12:16;
      for(let i=count-1;i>=0;i--){
        const end=parseDay(today),offset=(end.getDay()+6)%7;end.setDate(end.getDate()-offset-7*i);
        const start=new Date(end);start.setDate(start.getDate()-6);
        const s=localISO(start),e=localISO(end);
        buckets.push({key:s,label:pretty(s,{month:'short',day:'numeric'}),value:sum(records.filter(r=>inRange(r.date,s,e)))});
      }
    }else{
      const months=[...records.map(r=>r.date.slice(0,7)),today.slice(0,7)].sort();
      let startMonth;
      if(records.length){const [y,m]=months[0].split('-').map(Number);startMonth=new Date(y,m-1,1,12)}
      else{const now=new Date();startMonth=new Date(now.getFullYear(),now.getMonth()-5,1,12)}
      const [lastYear,lastMonth]=months.at(-1).split('-').map(Number),endMonth=new Date(lastYear,lastMonth-1,1,12);
      for(const d=new Date(startMonth);d<=endMonth;d.setMonth(d.getMonth()+1)){
        const key=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
        buckets.push({key,label:d.toLocaleDateString(undefined,{month:'short',year:'2-digit'}),value:sum(records.filter(r=>r.date.startsWith(key)))});
      }
    }
    $('#chart-range').style.display=chartMode==='monthly'?'none':'';
    const total=buckets.reduce((a,b)=>a+b.value,0),max=Math.max(1,...buckets.map(b=>b.value));
    $('#chart-total').textContent=money(total);
    $('#chart-caption').textContent=chartMode==='daily'?`in the last ${chartRange} days`:chartMode==='weekly'?'in the weeks shown':`across ${buckets.length} calendar months`;
    const w=700,h=125,pad=8,step=(w-pad*2)/Math.max(1,buckets.length-1);
    const pts=buckets.map((b,i)=>`${pad+i*step},${h-8-(b.value/max)*(h-20)}`),line=pts.join(' '),area=`${pad},${h} ${line} ${pad+(buckets.length-1)*step},${h}`;
    const grid=[.25,.5,.75,1].map(q=>`<line x1="0" y1="${h-8-(h-20)*q}" x2="${w}" y2="${h-8-(h-20)*q}" stroke="var(--line)" stroke-dasharray="3 5"/>`).join('');
    const marks=buckets.map((b,i)=>{const [x,y]=pts[i].split(',');return `<circle cx="${x}" cy="${y}" r="${b.value?'3':'1.5'}" fill="var(--surface)" stroke="${b.value?'#567886':'#d4d9d2'}" stroke-width="2"><title>${b.label}: ${money(b.value)}</title></circle>`}).join('');
    $('#income-chart').innerHTML=`<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">${grid}<polygon points="${area}" fill="#7694a1" opacity=".10"/><polyline points="${line}" fill="none" stroke="#63808d" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>${marks}</svg>`;
    const indices=[0,Math.round((buckets.length-1)/3),Math.round(2*(buckets.length-1)/3),buckets.length-1];
    $('#chart-labels').innerHTML=[...new Set(indices)].map(i=>`<span>${buckets[i]?.label||''}</span>`).join('');
  }
  function recordHTML(r,history=false){const note=r.note||'No note added';return `<div class="${history?'history-row':'recent-item'}" data-id="${esc(r.id)}"><div class="record-date"><span class="date-icon">◷</span><span><strong>${pretty(r.date,{month:'short',day:'numeric',year:'numeric'})}</strong><small>${pretty(r.date,{weekday:'long'})}</small></span></div><div class="record-note">${esc(note)}</div><div class="record-amount">${money(r.amount)}</div><div class="record-actions"><button class="row-action edit-record" aria-label="Edit record" title="Edit">✎</button><button class="row-action delete-record" aria-label="Delete record" title="Delete">×</button></div></div>`}
  function renderRecent(){const rows=[...records].sort((a,b)=>b.date.localeCompare(a.date)||b.id.localeCompare(a.id)).slice(0,4);$('#recent-list').innerHTML=rows.length?rows.map(r=>recordHTML(r)).join(''):`<div class="empty-state"><div class="empty-icon">↗</div>No income yet. Add your first small win.</div>`;}
  function filteredRecords(){const now=todayISO();if(historyFilter==='daily')return records.filter(r=>r.date===now);if(historyFilter==='weekly'){const [s,e]=currentWeek();return records.filter(r=>inRange(r.date,s,e))}if(historyFilter==='monthly')return records.filter(r=>r.date.startsWith(now.slice(0,7)));if(historyFilter==='custom'&&customRange)return records.filter(r=>inRange(r.date,customRange[0],customRange[1]));return records}
  function renderHistory(){let rows=filteredRecords();const sort=$('#sort-order').value;rows=[...rows].sort(sort==='oldest'?(a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id):sort==='amount'?(a,b)=>b.amount-a.amount||b.date.localeCompare(a.date):(a,b)=>b.date.localeCompare(a.date)||b.id.localeCompare(a.id));$('#history-summary').innerHTML=`<strong>${rows.length}</strong> ${rows.length===1?'record':'records'} · <strong>${money(sum(rows))}</strong> total`;$('#history-list').innerHTML=rows.length?`<div class="history-table-head"><span>Date</span><span>Note</span><span>Amount</span><span></span></div>${rows.map(r=>recordHTML(r,true)).join('')}`:`<div class="empty-state"><div class="empty-icon">◷</div>No records in this view.</div>`}
  function renderCalendar(){
    const monthly=calendarView==='monthly';
    $('#calendar-panel').hidden=monthly;$('#day-detail').hidden=monthly;$('#monthly-totals-panel').hidden=!monthly;$('#calendar-legend').hidden=monthly;
    $$('[data-calendar-view]').forEach(b=>b.classList.toggle('selected',b.dataset.calendarView===calendarView));
    if(monthly){renderMonthlyTotals();return}
    const year=calendarDate.getFullYear(),month=calendarDate.getMonth();
    const first=new Date(year,month,1,12),offset=(first.getDay()+6)%7;
    const start=new Date(year,month,1-offset,12),map=byDay(),grid=$('#calendar-grid');
    $('#calendar-month').textContent=first.toLocaleDateString(undefined,{month:'long',year:'numeric'});
    const prefix=`${year}-${String(month+1).padStart(2,'0')}`;
    const monthTotal=sum(records.filter(r=>r.date.startsWith(prefix)));
    $('#calendar-total').textContent=`${money(monthTotal)} this month`;
    let html=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d=>`<div class="weekday">${d}</div>`).join('');
    for(let i=0;i<42;i++){
      const d=new Date(start);d.setDate(start.getDate()+i);
      const iso=localISO(d),amt=map.get(iso),exists=records.some(r=>r.date===iso),zero=exists&&amt===0;
      html+=`<button class="calendar-cell ${d.getMonth()!==month?'outside':''} ${iso===todayISO()?'today':''} ${iso===selectedDate?'selected':''} ${zero?'zero':''} ${amt>0?'earned':''} ${dailyNotes[iso]?'has-note':''}" data-date="${iso}" aria-label="${pretty(iso,{month:'long',day:'numeric',year:'numeric'})}${exists?`, ${money(amt)} income`:''}${dailyNotes[iso]?', daily note saved':''}"><span class="day-number">${d.getDate()}</span>${dailyNotes[iso]?'<span class="note-mark" aria-hidden="true">✎</span>':''}${exists?`<span class="income-dot"></span><div class="day-amount">${amt===0?'0 ETB':compactMoney(amt)}</div>`:''}</button>`;
      if(i%7===6){
        const weekStart=new Date(start);weekStart.setDate(start.getDate()+i-6);
        const weekEnd=new Date(weekStart);weekEnd.setDate(weekStart.getDate()+6);
        const weekAmount=sum(records.filter(r=>inRange(r.date,localISO(weekStart),localISO(weekEnd))));
        html+=`<div class="calendar-week-total"><span>WEEK TOTAL <small>${pretty(localISO(weekStart),{month:'short',day:'numeric'})} – ${pretty(localISO(weekEnd),{month:'short',day:'numeric'})}</small></span><strong>${money(weekAmount)}</strong></div>`;
      }
    }
    grid.innerHTML=html;renderSelectedDay();
  }
  function renderMonthlyTotals(){
    const nowMonth=todayISO().slice(0,7),months=[...records.map(r=>r.date.slice(0,7)),nowMonth].sort();
    let startMonth;
    if(records.length){const [y,m]=months[0].split('-').map(Number);startMonth=new Date(y,m-1,1,12)}
    else{const now=new Date();startMonth=new Date(now.getFullYear(),now.getMonth()-5,1,12)}
    const [lastYear,lastMonth]=months.at(-1).split('-').map(Number),endMonth=new Date(lastYear,lastMonth-1,1,12),monthRows=[];
    for(const d=new Date(startMonth);d<=endMonth;d.setMonth(d.getMonth()+1)){
      const key=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`,rows=records.filter(r=>r.date.startsWith(key)),dayTotals=new Map();
      rows.forEach(r=>dayTotals.set(r.date,(dayTotals.get(r.date)||0)+r.amount));
      monthRows.push({key,label:d.toLocaleDateString(undefined,{month:'long',year:'numeric'}),total:sum(rows),days:[...dayTotals.values()].filter(v=>v>0).length,entries:rows.length});
    }
    const max=Math.max(1,...monthRows.map(m=>m.total));
    const selected=monthRows.find(m=>m.key===nowMonth)?.key||monthRows.at(-1)?.key||'';
    const exportTools=`<div class="monthly-report-toolbar"><label for="report-month-select">Report month<select id="report-month-select">${monthRows.map(m=>`<option value="${m.key}" ${m.key===selected?'selected':''}>${m.label}</option>`).join('')}</select></label><div><button class="secondary-btn" id="save-month-image">Save as image</button><button class="primary-btn" id="save-month-pdf">Save as PDF</button></div></div>`;
    const monthList=monthRows.length?monthRows.map(m=>`<button class="month-total-row" data-open-month="${m.key}" aria-label="Open ${m.label} calendar, total ${money(m.total)}"><span class="month-total-date"><i class="month-total-icon">↗</i><span><strong>${m.label}</strong><small>${m.days} earning ${m.days===1?'day':'days'} · ${m.entries} ${m.entries===1?'entry':'entries'}</small></span></span><span class="month-total-meter"><i style="width:${Math.max(m.total?4:0,m.total/max*100)}%"></i></span><strong class="month-total-value">${money(m.total)}</strong><span class="month-row-arrow">→</span></button>`).join(''):`<div class="empty-state">No monthly income to show yet.</div>`;
    $('#month-totals-list').innerHTML=exportTools+monthList;
  }
  function monthlyReportModel(key){
    const [year,month]=key.split('-').map(Number),monthRows=records.filter(r=>r.date.startsWith(key)),daily=new Map();
    monthRows.forEach(r=>daily.set(r.date,(daily.get(r.date)||0)+r.amount));
    const days=[...daily].sort(([a],[b])=>a.localeCompare(b)),earningDays=days.filter(([,amount])=>amount>0),highest=earningDays.slice().sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]))[0]||null;
    return{key,year,month,label:new Date(year,month-1,1,12).toLocaleDateString(undefined,{month:'long',year:'numeric'}),total:sum(monthRows),entryCount:monthRows.length,days,earningDays:earningDays.length,average:earningDays.length?sum(monthRows)/earningDays.length:0,highest,daysInMonth:new Date(year,month,0).getDate()};
  }
  function roundedRect(ctx,x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);ctx.quadraticCurveTo(x+w,y,x+w,y+r);ctx.lineTo(x+w,y+h-r);ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);ctx.lineTo(x+r,y+h);ctx.quadraticCurveTo(x,y+h,x,y+h-r);ctx.lineTo(x,y+r);ctx.quadraticCurveTo(x,y,x+r,y);ctx.closePath()}
  function drawReportText(ctx,text,x,y,font,color,maxWidth){ctx.font=font;ctx.fillStyle=color;ctx.textBaseline='top';if(Number.isFinite(maxWidth)&&maxWidth>0)ctx.fillText(String(text),x,y,maxWidth);else ctx.fillText(String(text),x,y)}
  function buildMonthlyReportCanvas(key){
    const report=monthlyReportModel(key),canvas=document.createElement('canvas');canvas.width=1200;canvas.height=1600;const ctx=canvas.getContext('2d');
    ctx.fillStyle='#eff3f5';ctx.fillRect(0,0,1200,1600);roundedRect(ctx,32,32,1136,1536,28);ctx.fillStyle='#fff';ctx.fill();
    const gradient=ctx.createLinearGradient(52,50,1148,430);gradient.addColorStop(0,'#284d5d');gradient.addColorStop(.58,'#3d6475');gradient.addColorStop(1,'#5e808f');roundedRect(ctx,52,52,1096,350,24);ctx.fillStyle=gradient;ctx.fill();ctx.fillRect(52,370,1096,32);
    ctx.strokeStyle='rgba(255,255,255,.35)';ctx.lineWidth=3;ctx.beginPath();ctx.arc(108,112,25,0,Math.PI*2);ctx.stroke();ctx.beginPath();ctx.moveTo(91,122);ctx.lineTo(101,122);ctx.lineTo(101,112);ctx.lineTo(111,112);ctx.lineTo(111,102);ctx.lineTo(126,102);ctx.stroke();
    drawReportText(ctx,'BirrFlow',150,83,'700 25px Manrope, Arial','#fff');drawReportText(ctx,'MONTHLY INCOME REPORT',76,157,'700 13px Arial','#cbdce3');drawReportText(ctx,report.label,76,190,'600 31px Manrope, Arial','#fff');
    drawReportText(ctx,'TOTAL INCOME',76,258,'700 11px Arial','#cbdce3');drawReportText(ctx,`${money(report.total)}`,76,282,'700 42px Manrope, Arial','#fff');
    const cards=[{title:'EARNING DAYS',value:String(report.earningDays),detail:'days with income'},{title:'AVERAGE PER EARNING DAY',value:money(report.average),detail:`${report.earningDays} earning ${report.earningDays===1?'day':'days'}`},{title:'HIGHEST DAY',value:report.highest?money(report.highest[1]):'—',detail:report.highest?pretty(report.highest[0],{month:'short',day:'numeric'}):'No income recorded'}];
    cards.forEach((card,i)=>{const x=70+i*354,y=430,w=332,h=132;roundedRect(ctx,x,y,w,h,14);ctx.fillStyle=i===0?'#ebf1f4':i===1?'#f7f3e8':'#edf2f4';ctx.fill();drawReportText(ctx,card.title,x+20,y+18,'700 10px Arial','#849080',w-40);drawReportText(ctx,card.value,x+20,y+44,'700 21px Manrope, Arial','#263136',w-40);drawReportText(ctx,card.detail,x+20,y+88,'400 10px Arial','#92998f',w-40)});
    drawReportText(ctx,'DAILY INCOME',76,610,'700 12px Arial','#71816f');drawReportText(ctx,'Recorded daily totals',76,632,'400 10px Arial','#a1a79f');
    const chart={x:92,y:690,w:1016,h:190},dayValues=Array.from({length:report.daysInMonth},(_,i)=>report.days.find(([date])=>parseDay(date).getDate()===i+1)?.[1]||0),max=Math.max(1,...dayValues),slot=chart.w/dayValues.length,bar=Math.max(5,slot*.56),base=chart.y+chart.h;
    [.25,.5,.75,1].forEach(q=>{const y=base-chart.h*q;ctx.strokeStyle='#e9ede7';ctx.setLineDash([5,7]);ctx.beginPath();ctx.moveTo(chart.x,y);ctx.lineTo(chart.x+chart.w,y);ctx.stroke()});ctx.setLineDash([]);
    dayValues.forEach((value,i)=>{if(!value)return;const height=value/max*(chart.h-12),x=chart.x+i*slot+(slot-bar)/2,y=base-height;roundedRect(ctx,x,y,bar,height,Math.min(5,bar/2));ctx.fillStyle='#7193a1';ctx.fill()});
    [1,5,10,15,20,25,report.daysInMonth].filter((d,i,a)=>a.indexOf(d)===i).forEach(d=>drawReportText(ctx,String(d),chart.x+(d-.5)*slot-6,base+11,'400 9px Arial','#9ca39a'));
    drawReportText(ctx,`RECORDED DAYS · ${report.days.length}`,76,938,'700 12px Arial','#71816f');
    if(!report.days.length)drawReportText(ctx,'No income records for this month.',76,978,'400 12px Arial','#92998f');
    const perColumn=Math.ceil(report.days.length/2),columns=[report.days.slice(0,perColumn),report.days.slice(perColumn)];
    columns.forEach((rows,col)=>rows.forEach(([date,amount],i)=>{const x=76+col*548,y=976+i*30;ctx.strokeStyle='#edf0eb';ctx.beginPath();ctx.moveTo(x,y+25);ctx.lineTo(x+500,y+25);ctx.stroke();drawReportText(ctx,pretty(date,{month:'short',day:'numeric',year:'numeric'}),x,y,'400 11px Arial','#687366');ctx.textAlign='right';drawReportText(ctx,money(amount),x+500,y,'700 11px Manrope, Arial','#31505e');ctx.textAlign='left'}));
    ctx.strokeStyle='#e8ece6';ctx.beginPath();ctx.moveTo(76,1490);ctx.lineTo(1124,1490);ctx.stroke();drawReportText(ctx,'BirrFlow · Made by Jo Ini',76,1510,'600 10px Arial','#839080');drawReportText(ctx,'Amounts in ETB · Ethiopian birr',1124,1510,'400 10px Arial','#99a096');
    return canvas;
  }
  function bytesFromText(text){return new TextEncoder().encode(text)}
  function imagePdfBlob(canvas,jpegBytes){
    const encoder=new TextEncoder(),parts=[],offsets=[0];let length=0;
    const push=bytes=>{parts.push(bytes);length+=bytes.length};
    const text=value=>push(encoder.encode(value));
    text('%PDF-1.4\n');
    const object=(number,body)=>{offsets[number]=length;text(`${number} 0 obj\n`);if(Array.isArray(body))body.forEach(push);else text(body);text('\nendobj\n')};
    object(1,'<< /Type /Catalog /Pages 2 0 R >>');object(2,'<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
    object(3,'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 816] /Resources << /XObject << /Im0 5 0 R >> >> /Contents 4 0 R >>');
    const content=encoder.encode('q 612 0 0 816 0 0 cm /Im0 Do Q');
    object(4,[encoder.encode(`<< /Length ${content.length} >>\nstream\n`),content,encoder.encode('\nendstream')]);
    object(5,[encoder.encode(`<< /Type /XObject /Subtype /Image /Width ${canvas.width} /Height ${canvas.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBytes.length} >>\nstream\n`),jpegBytes,encoder.encode('\nendstream')]);
    const xref=length;text(`xref\n0 6\n0000000000 65535 f \n`);for(let i=1;i<=5;i++)text(`${String(offsets[i]).padStart(10,'0')} 00000 n \n`);text(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
    return new Blob(parts,{type:'application/pdf'});
  }
  async function saveMonthlyReport(kind){
    const key=$('#report-month-select').value;if(!key){toast('Choose a month first');return}
    try{const canvas=buildMonthlyReportCanvas(key),filename=`all-money-in-${key}-report`;
      if(kind==='image'){const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob)throw new Error('Image export is not available in this browser.');downloadBlob(blob,`${filename}.png`)}
      else{const jpg=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.94));if(!jpg)throw new Error('PDF export is not available in this browser.');downloadBlob(imagePdfBlob(canvas,new Uint8Array(await jpg.arrayBuffer())),`${filename}.pdf`)}
      toast(`Monthly report saved as ${kind==='image'?'PNG':'PDF'}`);
    }catch(error){toast(error.message||'Could not save this report')}
  }
  function downloadBlob(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500)}
  function compactMoney(n){return n>=1e6?`${(n/1e6).toFixed(1)}m`:n>=1e4?`${(n/1e3).toFixed(0)}k`:new Intl.NumberFormat('en-US',{maximumFractionDigits:0}).format(n)}
  function renderSelectedDay(){const rows=records.filter(r=>r.date===selectedDate);$('#selected-day-title').textContent=pretty(selectedDate,{weekday:'long',month:'long',day:'numeric',year:'numeric'});$('#selected-day-list').innerHTML=rows.length?rows.map(r=>recordHTML(r,true)).join(''):`<div class="empty-state">No income recorded for this day yet.</div>`;$('#daily-note-text').value=dailyNotes[selectedDate]||'';$('#daily-note-status').textContent=dailyNotes[selectedDate]?'Saved on this device':''}
  function esc(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
  function openForm(record=null,date=null){$('#income-form').reset();$('#record-id').value=record?.id||'';$('#income-date').value=record?.date||date||todayISO();$('#income-amount').value=record?record.amount:'';$('#income-note').value=record?.note||'';$('#dialog-title').textContent=record?'Edit your income':'Add your income';$('#form-error').textContent='';$('#income-dialog').showModal();if(!record)setTimeout(()=>$('#income-amount').focus(),80)}
  function saveForm(e){e.preventDefault();const date=$('#income-date').value,amountInput=$('#income-amount').value,amount=Number(amountInput),note=$('#income-note').value.trim(),id=$('#record-id').value;if(!date){$('#form-error').textContent='Please choose a date.';return}if(amountInput===''||!Number.isFinite(amount)||amount<0){$('#form-error').textContent='Enter an amount of 0 or more.';return}if(amount>1e12){$('#form-error').textContent='That amount is too large.';return}const existing=records.find(r=>r.id===id);if(existing){Object.assign(existing,{date,amount,note})}else records.push({id:crypto.randomUUID(),date,amount,note});persist();$('#income-dialog').close();renderAll();toast(existing?'Income updated':'Income saved')}
  function renderAll(){renderDashboard();if(activePage==='history')renderHistory();if(activePage==='calendar')renderCalendar()}
  function deleteRecord(id){const r=records.find(x=>x.id===id);if(!r)return;if(!confirm(`Delete this ${money(r.amount)} record from ${pretty(r.date)}?`))return;records=records.filter(x=>x.id!==id);persist();renderAll();toast('Record deleted')}
  document.addEventListener('click',e=>{const nav=e.target.closest('[data-page]');if(nav){setPage(nav.dataset.page);return}const goto=e.target.closest('[data-goto]');if(goto){setPage(goto.dataset.goto);return}if(e.target.closest('#quick-add')||e.target.closest('#history-add')){openForm();return}if(e.target.closest('#add-selected-day')){openForm(null,selectedDate);return}if(e.target.closest('#close-dialog')||e.target.closest('#cancel-dialog')){$('#income-dialog').close();return}const edit=e.target.closest('.edit-record');if(edit){const r=records.find(x=>x.id===edit.closest('[data-id]').dataset.id);if(r)openForm(r);return}const del=e.target.closest('.delete-record');if(del){deleteRecord(del.closest('[data-id]').dataset.id);return}const range=e.target.closest('#chart-range button');if(range){chartRange=Number(range.dataset.range);$$('#chart-range button').forEach(b=>b.classList.toggle('selected',b===range));renderChart();return}const mode=e.target.closest('[data-chart]');if(mode){chartMode=mode.dataset.chart;$('#chart-select').firstChild.textContent=mode.textContent+' ';$('#chart-select').classList.remove('open');renderChart();return}if(e.target.closest('#chart-select')){$('#chart-select').classList.toggle('open');return}if(!e.target.closest('.select-control'))$('#chart-select').classList.remove('open');const filter=e.target.closest('.filter-btn');if(filter){historyFilter=filter.dataset.filter;$$('.filter-btn').forEach(b=>b.classList.toggle('selected',b===filter));$('#custom-dates').classList.toggle('visible',historyFilter==='custom');if(historyFilter!=='custom')renderHistory();return}const cell=e.target.closest('.calendar-cell');if(cell){selectedDate=cell.dataset.date;renderCalendar()}});
  document.addEventListener('click',e=>{
    const imageReport=e.target.closest('#save-month-image');if(imageReport){saveMonthlyReport('image');return}
    const pdfReport=e.target.closest('#save-month-pdf');if(pdfReport){saveMonthlyReport('pdf');return}
    const view=e.target.closest('[data-calendar-view]');
    if(view){calendarView=view.dataset.calendarView;renderCalendar();return}
    const month=e.target.closest('[data-open-month]');
    if(month){const [year,number]=month.dataset.openMonth.split('-').map(Number);calendarDate=new Date(year,number-1,1,12);selectedDate=localISO(calendarDate);calendarView='calendar';renderCalendar()}
  });
  $('#pin-setup-form').addEventListener('submit',e=>savePin(e,false));$('#pin-change-form').addEventListener('submit',e=>savePin(e,true));
  $('#lock-timeout').addEventListener('change',()=>{if(!securityConfig)return;securityConfig.timeout=Number($('#lock-timeout').value);localStorage.setItem(SECURITY_KEY,JSON.stringify(securityConfig));lastActivity=Date.now();startIdleTimer();toast('Auto-lock time updated')});
  $('#lock-now').addEventListener('click',lockNow);
  $('#remove-lock').addEventListener('click',()=>{if(!securityConfig)return;if(!confirm('Turn off the app lock on this device?'))return;clearTimeout(lockTimer);localStorage.removeItem(SECURITY_KEY);securityConfig=null;renderSettings();toast('App lock turned off')});
  $('#unlock-form').addEventListener('submit',async e=>{e.preventDefault();if(!securityConfig){unlockApp();return}const button=e.submitter;button.disabled=true;$('#unlock-message').textContent='Checking PIN…';try{const attempt=await hashPin($('#unlock-pin').value,fromBase64(securityConfig.salt));if(equalHash(attempt,securityConfig.hash))unlockApp();else{$('#unlock-message').textContent='That PIN did not match. Try again.';$('#unlock-pin').select()}}catch(error){$('#unlock-message').textContent=error.message||'Could not check the PIN.'}finally{button.disabled=false}});
  for(const event of ['pointerdown','keydown','touchstart'])document.addEventListener(event,()=>{if(!locked){lastActivity=Date.now();startIdleTimer()}},{passive:true});
  document.addEventListener('visibilitychange',()=>{if(document.hidden||!securityConfig||locked)return;if(Date.now()-lastActivity>=securityConfig.timeout*60*1000)lockNow();else startIdleTimer()});
  $('#income-form').addEventListener('submit',saveForm);$('#sort-order').addEventListener('change',renderHistory);$('#apply-custom').addEventListener('click',()=>{const s=$('#filter-from').value,e=$('#filter-to').value;if(!s||!e||s>e){toast('Choose a valid date range');return}customRange=[s,e];renderHistory()});$('#chart-select').addEventListener('click',e=>{if(e.target.matches('button[data-chart]'))return});$('#prev-month').addEventListener('click',()=>{calendarDate.setMonth(calendarDate.getMonth()-1);renderCalendar()});$('#next-month').addEventListener('click',()=>{calendarDate.setMonth(calendarDate.getMonth()+1);renderCalendar()});$('#calendar-today').addEventListener('click',()=>{calendarDate=new Date();selectedDate=todayISO();renderCalendar()});
  $('#save-daily-note').addEventListener('click',()=>{const note=$('#daily-note-text').value.trim();if(note)dailyNotes[selectedDate]=note;else delete dailyNotes[selectedDate];localStorage.setItem(DAILY_NOTES_KEY,JSON.stringify(dailyNotes));renderCalendar();toast(note?'Daily note saved':'Daily note cleared')});
  function setTheme(dark){document.body.classList.toggle('dark',dark);localStorage.setItem(THEME,dark?'dark':'light')}function toggleTheme(){setTheme(!document.body.classList.contains('dark'))}$('#theme-toggle').addEventListener('click',toggleTheme);$('#top-theme').addEventListener('click',toggleTheme);setTheme(localStorage.getItem(THEME)==='dark');
  $('#export-btn').addEventListener('click',()=>{const rows=[['Type','Date','Amount (ETB)','Note'],...records.slice().sort((a,b)=>a.date.localeCompare(b.date)).map(r=>['Income',r.date,String(r.amount),r.note]),...Object.entries(dailyNotes).sort(([a],[b])=>a.localeCompare(b)).map(([date,note])=>['Daily expense note',date,'',note])];const csv=rows.map(row=>row.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',')).join('\r\n');const a=document.createElement('a');a.href=URL.createObjectURL(new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'}));a.download=`birrflow-income-${todayISO()}.csv`;a.click();URL.revokeObjectURL(a.href);toast('CSV exported')});function downloadBackup(){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify({format:'daymark-backup-v1',records,dailyNotes},null,2)],{type:'application/json'}));a.download='birrflow-backup-'+todayISO()+'.json';a.click();URL.revokeObjectURL(a.href);toast('Backup downloaded')}
document.querySelectorAll('[data-backup-action="download"]').forEach(b=>b.addEventListener('click',downloadBackup));
document.querySelectorAll('[data-backup-action="restore"]').forEach(b=>b.addEventListener('click',()=>$('#restore-file').click()));$('#restore-file').addEventListener('change',async e=>{const f=e.target.files[0];if(!f)return;try{const data=JSON.parse(await f.text()),list=Array.isArray(data)?data:data.records,notes=data.dailyNotes||dailyNotes;if(!Array.isArray(list)||list.some(r=>!r||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(r.date)||!Number.isFinite(+r.amount)||+r.amount<0||String(r.note||'').length>120)||!notes||typeof notes!=='object'||Array.isArray(notes)||Object.entries(notes).some(([date,note])=>!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(date)||typeof note!=='string'||note.length>500))throw Error('invalid');records=list.map(r=>({id:crypto.randomUUID(),date:r.date,amount:+r.amount,note:String(r.note||'')}));dailyNotes=notes;persist();localStorage.setItem(DAILY_NOTES_KEY,JSON.stringify(dailyNotes));renderAll();toast('Backup restored')}catch{toast('Could not restore this backup')}e.target.value=''});
  $$('.nav-link[data-page]').forEach(b=>b.addEventListener('click',()=>setPage(b.dataset.page)));$('#today-note').textContent='A fresh day to earn';const now=new Date();updateDailyQuote();scheduleQuoteRefresh();const greet=now.getHours();document.querySelector('#page-dashboard h1').innerHTML=`Good ${greet<12?'morning':greet<18?'afternoon':'evening'}<span class="heading-period">.</span>`;renderSettings();renderAll();if(securityConfig)lockNow();else startIdleTimer();
})();

