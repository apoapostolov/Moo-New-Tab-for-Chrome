/* Calendar reminders run in the extension background, independently of open new tabs. */
(function (root) {
  const KEY='mooCalendarAlerts',PREFIX='moo-calendar:',GRACE=5*60000;
  const accountOf=auth=>auth?`${auth.email}:${auth.connectedAt}`:'';
  function createCalendarAlerts(api,clock=()=>Date.now()) {
    let queue=Promise.resolve();
    const serial=action=>(...args)=>{const next=queue.then(()=>action(...args));queue=next.catch(()=>{});return next;};
    const read=async()=> (await api.storage.local.get(KEY))[KEY]||null;
    const currentAccount=async()=>accountOf((await api.storage.local.get('googleAuth')).googleAuth);
    const allowed=async()=>api.permissions.contains({permissions:['notifications']});
    const owned=async()=> (await api.alarms.getAll()).filter(alarm=>alarm.name.startsWith(PREFIX));
    const cancel=async()=>Promise.all((await owned()).map(alarm=>api.alarms.clear(alarm.name)));
    const clear=async()=>{await cancel();await api.storage.local.remove(KEY);};
    const trim=values=>Object.fromEntries(Object.entries(values||{}).filter(([,at])=>Number.isFinite(at)&&at>clock()-60*86400000).sort((a,b)=>b[1]-a[1]).slice(0,5000));
    const records=state=>state.events.flatMap(event=>[...new Set(event.minutes)].map(minutes=>({
      ...event,when:event.start-minutes*60000,name:PREFIX+encodeURIComponent(JSON.stringify([state.account,event.occurrence,minutes])),
    }))).filter(item=>item.end>clock()&&item.when>=clock()-GRACE&&!state.delivered[item.name]&&!(state.invalidated[item.key]>state.updated)).sort((a,b)=>a.when-b.when).slice(0,1000);
    const schedule=async state=>{
      await cancel();
      for(const item of records(state))await api.alarms.create(item.name,{when:Math.max(clock()+100,item.when)});
    };
    const validEvent=event=>event&&typeof event.key==='string'&&event.key.length<=2500&&typeof event.occurrence==='string'&&event.occurrence.length<=3000&&typeof event.title==='string'&&typeof event.message==='string'&&Number.isFinite(event.start)&&Number.isFinite(event.end)&&event.end>event.start&&Array.isArray(event.minutes)&&event.minutes.length<=5&&event.minutes.every(m=>Number.isInteger(m)&&m>=0&&m<=40320);
    const sync=async message=>{
      if(message.account!==await currentAccount()||!await allowed())return false;
      if(!Array.isArray(message.events)||message.events.length>2500||!message.events.every(validEvent)||!Number.isFinite(message.updated))throw Error('Invalid calendar alert snapshot');
      const previous=await read();
      if(previous?.account===message.account&&previous.updated>message.updated)return false;
      const same=previous?.account===message.account?previous:{};
      const state={account:message.account,updated:message.updated,events:message.events.map(e=>({...e,title:e.title.slice(0,300),message:e.message.slice(0,500)})),fired:trim(same.fired),delivered:trim(same.delivered),invalidated:trim(same.invalidated)};
      await api.storage.local.set({[KEY]:state});await schedule(state);return true;
    };
    const restore=async()=>{
      const state=await read();
      if(!state)return;
      if(state.account!==await currentAccount()||!await allowed()){await clear();return;}
      state.invalidated ||= {};state.delivered ||= {};state.fired ||= {};
      await schedule(state);
    };
    const fire=async alarm=>{
      if(!alarm.name.startsWith(PREFIX))return;
      const state=await read();
      if(!state||state.account!==await currentAccount()||!await allowed()){await clear();return;}
      const item=records(state).find(event=>event.name===alarm.name);
      if(!item||item.when>clock()+1000)return;
      const id=await api.notifications.create(item.name,{type:'basic',iconUrl:api.runtime.getURL('icons/128x128.png'),title:item.title,message:item.message});
      if(!id)return;
      state.delivered[item.name]=clock();state.fired[item.occurrence]=clock();
      state.fired=trim(state.fired);state.delivered=trim(state.delivered);
      await api.storage.local.set({[KEY]:state});
      await schedule(state);
    };
    const remove=async key=>{
      const state=await read();if(!state)return;
      state.invalidated[key]=clock();state.events=state.events.filter(event=>event.key!==key);
      await api.storage.local.set({[KEY]:state});await schedule(state);
    };
    return {sync:serial(sync),restore:serial(restore),fire:serial(fire),clear:serial(clear),remove:serial(remove)};
  }
  root.MooCalendarAlerts={createCalendarAlerts};
  const api=root.browser||root.chrome;
  if(!api?.runtime?.onMessage||!api?.alarms)return;
  const engine=createCalendarAlerts(api);
  api.runtime.onMessage.addListener((message,sender,sendResponse)=>{
    if(sender.id!==api.runtime.id)return undefined;
    let response;
    if(message?.type==='moo-calendar-alert-sync')response=engine.sync(message);
    else if(message?.type==='moo-calendar-alert-clear')response=engine.clear();
    else if(message?.type==='moo-calendar-alert-remove'&&typeof message.key==='string')response=engine.remove(message.key);
    else return undefined;
    // Keep the response channel open on Chrome versions without Promise listeners.
    response.then(value=>sendResponse(value??null),()=>sendResponse(false));
    return true;
  });
  api.alarms.onAlarm.addListener(alarm=>engine.fire(alarm).catch(()=>{}));
  api.runtime.onStartup.addListener(()=>engine.restore().catch(()=>{}));
  api.runtime.onInstalled.addListener(()=>engine.restore().catch(()=>{}));
  api.storage.onChanged.addListener((changes,area)=>{
    if(area==='local'&&changes.googleAuth&&accountOf(changes.googleAuth.oldValue)!==accountOf(changes.googleAuth.newValue))engine.clear().catch(()=>{});
  });
  let clicked=false;
  const bindClick=()=>{
    if(clicked||!api.notifications?.onClicked)return;
    clicked=true;api.notifications.onClicked.addListener(id=>{
      if(!id.startsWith(PREFIX))return;
      api.notifications.clear(id).catch(()=>{});
      api.tabs.create({url:api.runtime.getURL('index.html')});
    });
  };
  api.permissions.onAdded.addListener(permissions=>{if(permissions.permissions?.includes('notifications')){bindClick();engine.restore().catch(()=>{});}});
  api.permissions.onRemoved.addListener(permissions=>{if(permissions.permissions?.includes('notifications'))engine.clear().catch(()=>{});});
  bindClick();engine.restore().catch(()=>{});
})(globalThis);
