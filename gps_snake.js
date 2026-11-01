/* Isolated GPS projection R3. Agreement points, capacity, and lifecycle remain server truth. */
(function(root){
 'use strict';
 // D531: UI words through the page's catalogue (uiText / uiFmt); the uk source when run standalone (Node guard, no page)
 const tr=s=>typeof uiText==='function'?uiText(s):s,fmt=(s,v)=>typeof uiFmt==='function'?uiFmt(s,v):s.replace(/\{(\w+)\}/g,(x,k)=>k in v?String(v[k]):x);
 const lang=()=>typeof S!=='undefined'&&S&&S.lang||'uk';
 const number=x=>x!==null&&x!==undefined&&x!==''&&Number.isFinite(Number(x))?Number(x):null;
 const terminal=x=>['done','completed','cancelled','canceled','missed_pickup'].includes(String(x||'').toLowerCase());
 const coord=m=>{const lat=number(m.lat),lng=number(m.lng);return lat!==null&&lng!==null&&Math.abs(lat)<=90&&Math.abs(lng)<=180?{lat,lng}:null;};
 function distance(a,b){const r=Math.PI/180,dy=(b.lat-a.lat)*r,dx=(b.lng-a.lng)*r;const q=Math.sin(dy/2)**2+Math.cos(a.lat*r)*Math.cos(b.lat*r)*Math.sin(dx/2)**2;return 6371000*2*Math.atan2(Math.sqrt(q),Math.sqrt(Math.max(0,1-q)));}
 function gpsPoint(m,now){
   const c=coord(m);if(!c)return null;
   const timestamp=number(m.location_updated_at),clock=number(now);
   const unknown=timestamp===null||timestamp<=0||clock===null||clock-timestamp < -5;
   const age=unknown?null:Math.max(0,clock-timestamp);
   return {...c,user:String(m.user_id),name:String(m.name||tr('Учасник')),role:m.role,request:m.request_id?String(m.request_id):null,timestamp,age,timeUnknown:unknown,fresh:!unknown&&age<=35};
 }
 function projectCrew(trip,now){
   if(!trip||!trip.active||!trip.crew_id||terminal(trip.status))return null;
   const seen=new Set();
   const members=(Array.isArray(trip.members)?trip.members:[]).filter(m=>{
     const uid=number(m.user_id);if(!uid||uid<=0||seen.has(String(uid)))return false;
     if(!['driver','passenger','client'].includes(m.role)||terminal(m.request_status)||(m.driver_finished&&m.client_finished))return false;
     if(m.crew_id&&String(m.crew_id)!==String(trip.crew_id))return false;
     if(m.role==='driver'&&String(m.user_id)!==String(trip.driver_id))return false;
     seen.add(String(uid));return true;
   });
   const driver=members.find(m=>m.role==='driver'&&String(m.user_id)===String(trip.driver_id));
   const people=members.map(m=>gpsPoint(m,now)).filter(Boolean);
   const head=people.find(p=>p.role==='driver')||null;
   const tail=members.filter(m=>m.role!=='driver'&&m.request_id&&String(m.passenger_pickup_status).toLowerCase()==='picked_up')
     .sort((a,b)=>Number(a.picked_up_at||0)-Number(b.picked_up_at||0)||Number(a.request_id)-Number(b.request_id))
     .map(m=>{
       const gps=people.find(p=>p.user===String(m.user_id));let detail=gps?{...gps}:null;
       if(detail){const boarding=number(m.picked_up_at);detail.relation=boarding===null||detail.timestamp===null?'time_unknown':detail.timestamp<=boarding?'before_boarding':head&&distance(detail,head)<=200?'near_car':'different_position';}
       return {user:String(m.user_id),request:String(m.request_id),name:String(m.name||tr('Попутник')),finishPending:!!(m.driver_finished||m.client_finished),gps:detail};
     });
   const personPins=people.filter(p=>p.role!=='driver').flatMap(p=>{
     const boarded=tail.find(t=>t.user===p.user);
     if(!boarded||!head)return [{...p,difference:false,boarded:!!boarded,relation:boarded?.gps?.relation,finishPending:!!boarded?.finishPending}];
     return boarded.gps&&boarded.gps.relation==='different_position'?[{...p,difference:true}]:[];
   });
   const usesNativeGps=p=>{const m=members.find(m=>String(m.user_id)===p.user);return !coord({lat:m.pickup_lat,lng:m.pickup_lng});};
   return {crew:String(trip.crew_id),driver:String(trip.driver_id),head,lat:head?head.lat:null,lng:head?head.lng:null,age:head?head.age:null,
     timeUnknown:head?head.timeUnknown:true,fresh:!!head&&head.fresh,tail,people,personPins:personPins.filter(p=>!usesNativeGps(p)),nativeGpsPeople:personPins.filter(usesNativeGps)};
 }
 function createServerClock(monotonic){
   let anchor=null;
   return trip=>{
     const stamp=number(trip?.telemetry_server_now),crew=String(trip?.crew_id||'');
     if(stamp===null||stamp<=0)return null;
     const at=monotonic();
     if(!anchor||anchor.crew!==crew||stamp>anchor.stamp+Math.max(0,at-anchor.at)/1000)anchor={crew,stamp,at};
     return anchor.stamp+Math.max(0,at-anchor.at)/1000;
   };
 }
 if(typeof module!=='undefined'&&module.exports){module.exports={projectCrew,createServerClock};return;}
 root.GpsCrewProjection={projectCrew,createServerClock};
 const style=document.createElement('style');style.textContent=`.gps-crew-pin{position:relative;width:48px;height:48px;overflow:visible}.gps-crew-head{position:relative;width:44px;height:44px;border:3px solid #fff;border-radius:50%;background:#fbbf24;box-shadow:0 2px 10px #0008;display:grid;place-items:center;font-size:25px;z-index:2}.gps-crew-tail{position:absolute;top:7px;left:52px;display:flex;align-items:center;gap:7px;transform-origin:-30px 15px}.gps-crew-tail:before{content:'';position:absolute;left:-30px;right:10px;height:3px;background:#a3e635;z-index:-1}.gps-crew-person{width:28px;height:28px;border:2px solid white;background:#38bdf8;border-radius:50%;display:grid;place-items:center;font-size:15px;box-shadow:0 1px 4px #0008}.gps-finish-pending{background:#a78bfa;opacity:.65}.gps-crew-badge{position:absolute;top:20px;left:25px;width:16px;height:16px;padding:0;border-radius:50%;background:#fff url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%23dc2626%22%20stroke-width%3D%222.2%22%20stroke-linecap%3D%22round%22%3E%3Cpath%20d%3D%22M3%208.5a15%2015%200%200%201%2018%200M6.5%2012a9.5%209.5%200%200%201%2011%200M10%2015.5a4%204%200%200%201%204%200M4%203l17%2018%22%2F%3E%3Ccircle%20cx%3D%2212%22%20cy%3D%2219%22%20r%3D%221.2%22%20fill%3D%22%23dc2626%22%20stroke%3D%22none%22%2F%3E%3C%2Fsvg%3E") center/14px 14px no-repeat;box-shadow:0 1px 3px #0005}.gps-crew-badge[hidden]{display:none}.gps-crew-stale{opacity:.48}.gps-head-present .pickup-point-driver.map-at-point-stop:after{display:none}.gps-person-pin{position:relative;width:30px;height:30px;border:2px solid white;border-radius:50%;background:#38bdf8;display:grid;place-items:center;font-size:16px;box-shadow:0 2px 8px #0008}.gps-person-pin .gps-crew-badge{top:16px;left:18px}.gps-crew-start-label{font:10px sans-serif;background:#0f172a;color:#fff;padding:2px;border-radius:4px;white-space:nowrap}`;
 document.head.append(style);
 const readClock=createServerClock(()=>performance.now());
 const markers=new Map(),nativePopups=new WeakMap();let currentPeople=new Map(),prior=null,oldCrew='',direction=0;
 const ageText=p=>p.timeUnknown?tr('час GPS невідомий'):p.fresh?fmt('GPS · {n} с тому',{n:Math.floor(p.age)}):p.age<120?fmt('останнє місце · {n} с тому',{n:Math.floor(p.age)}):fmt('останнє місце · {n} хв тому',{n:Math.floor(p.age/60)});
 const signalBadge=(badge,point)=>{badge.textContent='';badge.hidden=!!point.fresh;badge.setAttribute('aria-hidden','true');badge.setAttribute('title',(point.fresh?tr('GPS оновлюється'):point.timeUnknown?tr('Час GPS невідомий'):tr('Позиція давно не оновлювалась'))+' · '+ageText(point));};
 const contact=(m,p)=>typeof crewMemberContactButtonsHtml==='function'?crewMemberContactButtonsHtml(m,p):'';
 const ageSpan=p=>`<span data-gps-popup-age="${escapeAttr(p.user)}"></span>`;
 function syncPopupAge(marker){
   const popup=marker.getPopup?.()?.getElement?.();
   popup?.querySelectorAll('[data-gps-popup-age]').forEach(e=>{const p=currentPeople.get(e.getAttribute('data-gps-popup-age'));if(p)e.textContent=ageText(p);});
 }
 function upsert(key,point,html,structure,popup,size,anchor,z){
   let rec=markers.get(key);
   if(!rec){const marker=L.marker([point.lat,point.lng],{icon:L.divIcon({className:'',html,iconSize:size,iconAnchor:anchor}),zIndexOffset:z,interactive:key!=='start'}).addTo(S.map);
     if(popup){marker.bindPopup(popup,{autoPan:false,keepInView:false});marker.on?.('popupopen',()=>syncPopupAge(marker));}rec={marker,structure,popup};markers.set(key,rec);
   }else{
     rec.marker.setLatLng([point.lat,point.lng]);
     if(rec.structure!==structure){rec.marker.setIcon(L.divIcon({className:'',html,iconSize:size,iconAnchor:anchor}));rec.structure=structure;}
     if(popup&&rec.popup!==popup){rec.marker.setPopupContent(popup);rec.popup=popup;}
   }
   syncPopupAge(rec.marker);return rec.marker.getElement();
 }
 function reconcileNativeGps(t,p){
   for(const marker of S._crewMemberMarkers||[]){
     const element=marker.getElement?.()?.querySelector('[data-crew-member]');if(!element)continue;
     const uid=element.getAttribute('data-crew-member'),member=t.members.find(m=>String(m.user_id)===uid);
     if(!member||coord({lat:member.pickup_lat,lng:member.pickup_lng}))continue; // A saved pickup is a separate agreement point.
     const point=p.nativeGpsPeople.find(point=>point.user===uid);
     if(!point){if(p.head&&p.tail.some(m=>m.user===uid))S.map.removeLayer(marker);continue;}
     const state=point.boarded?' · '+tr('у складі авто')+(point.relation==='before_boarding'?' · '+tr('до посадки'):''):'';
     const title=`${point.name}${state} · ${point.difference?tr('отримані GPS-позиції різні')+' · ':''}${ageText(point)}`;
     element.dataset.nativeGpsPerson=uid;element.dataset.liveFresh=String(point.fresh);element.style.opacity=point.fresh&&!point.difference?'1':'.48';element.setAttribute('aria-label',title);
     let badge=element.querySelector('[data-native-gps-age]');
     if(!badge){badge=document.createElement('span');badge.setAttribute('data-native-gps-age',uid);badge.className='gps-crew-badge';element.style.position='relative';badge.style.top='16px';badge.style.left='18px';element.append(badge);}signalBadge(badge,point);
     let rec=nativePopups.get(marker);
     if(!rec){const original=marker.getPopup?.()?.getContent?.();if(typeof original!=='string')continue;
       const boundary='</b><br>',split=original.indexOf(boundary);if(split<0)continue;const end=split+boundary.length,after=original.slice(end),next=after.indexOf('<');
       rec={prefix:original.slice(0,end),actions:next<0?'':after.slice(next),popup:null};nativePopups.set(marker,rec);marker.on?.('popupopen',()=>syncPopupAge(marker));}
     const popup=`${rec.prefix}${escapeHtml(state)}${point.difference?' · '+escapeHtml(tr('отримані GPS-позиції різні'))+' · ':''}${ageSpan(point)}${rec.actions}`;
     if(rec.popup!==popup){marker.setPopupContent(popup);rec.popup=popup;}syncPopupAge(marker);
   }
 }
 function renderGpsLayer(){
   if(!S.map)return;
   const t=S.activeTrip,p=projectCrew(t,readClock(t)),wanted=new Set();
   currentPeople=new Map((p?.people||[]).map(point=>[point.user,point]));
   document.body.classList.toggle('gps-head-present',!!p?.head&&p.fresh);
   if(p){
     if(oldCrew!==p.crew){prior=null;oldCrew=p.crew;direction=0;}
     if(p.head){
       if(prior&&(prior.lat!==p.lat||prior.lng!==p.lng)){const a=S.map.latLngToLayerPoint([prior.lat,prior.lng]),b=S.map.latLngToLayerPoint([p.lat,p.lng]);direction=Math.atan2(a.y-b.y,a.x-b.x)*180/Math.PI;}
       prior={lat:p.lat,lng:p.lng};
       const arrival = t.viewer_role !== 'driver' && p.fresh && typeof atPointArrivalForViewer === 'function' && atPointArrivalForViewer(t);
       const roster=p.tail.map(m=>`<span class="gps-crew-person${m.finishPending?' gps-finish-pending':''}" data-snake-member="${escapeAttr(m.user)}" title="${escapeAttr(m.name+' — '+(m.finishPending?tr('очікує завершення'):tr('у складі авто')))}">👤</span>`).join('');
       const title=`${ageText(p.head)} · ${fmt('склад: {n}',{n:p.tail.length})}`;
       let popup=`<b>${escapeHtml(p.head.name)} · GPS</b><br>${ageSpan(p.head)} · ${escapeHtml(fmt('склад: {n}',{n:p.tail.length}))}${contact(t.members.find(m=>String(m.user_id)===p.driver),p.head)}<hr>${escapeHtml(tr('Хвіст — склад авто за посадками, не окремі GPS.'))}<br>`;
       for(const m of p.tail){const detail=m.gps?`${m.gps.relation==='before_boarding'?' · '+tr('до посадки'):m.gps.relation==='near_car'?' · '+tr('поблизу отриманої позиції авто'):m.gps.relation==='different_position'?' · '+tr('отримані GPS-позиції різні'):''}`:tr('власного GPS ще немає');
         popup+=`<b>${escapeHtml(m.name)}</b>${m.finishPending?' · '+escapeHtml(tr('очікує завершення')):''}<br>${m.gps?ageSpan(m.gps):''}${escapeHtml(detail)}${contact(t.members.find(x=>String(x.user_id)===m.user),m.gps||p.head)}<br>`;}
       const html=`<div class="gps-crew-pin" data-live-crew="${escapeAttr(p.crew)}" role="img"><div class="gps-crew-tail">${roster}</div><div class="gps-crew-head" data-snake-driver="${escapeAttr(p.driver)}">🚗</div><span class="gps-crew-badge gps-age"></span></div>`;
       const element=upsert('head',p.head,html,JSON.stringify([lang(),...p.tail.map(m=>[m.user,m.name,m.finishPending])]),popup,[48,48],[24,24],1500);
       wanted.add('head');const pin=element.querySelector('[data-live-crew]');pin.dataset.liveFresh=String(p.fresh);pin.classList.toggle('gps-crew-stale',!p.fresh);pin.setAttribute('aria-label',title);signalBadge(pin.querySelector('.gps-age'),p.head);
       pin.querySelector('.gps-crew-head').classList.toggle('map-at-point-stop',arrival);pin.querySelector('.gps-crew-tail').style.transform=`rotate(${direction}deg)`;
       pin.querySelectorAll('.gps-crew-person').forEach(e=>e.style.transform=`rotate(${-direction}deg)`);
     }
     for(const point of p.personPins){
       const state=point.boarded?' · '+tr('у складі авто')+(point.relation==='before_boarding'?' · '+tr('до посадки'):''):'';
       const key='person:'+point.user,title=`${point.name}${state} · ${point.difference?tr('отримані GPS-позиції різні')+' · ':''}${ageText(point)}`;
       const html=`<div class="gps-person-pin" data-live-person="${escapeAttr(point.user)}" role="img">👤<span class="gps-crew-badge gps-age"></span></div>`;
       const member=t.members.find(m=>String(m.user_id)===point.user);
       const element=upsert(key,point,html,point.user,`<b>${escapeHtml(point.name)}</b><br>${escapeHtml(state)}${point.difference?' · '+escapeHtml(tr('отримані GPS-позиції різні'))+' · ':''}${ageSpan(point)}${contact(member,point)}`,[30,30],[15,15],1400);
       wanted.add(key);const pin=element.querySelector('[data-live-person]');pin.dataset.gpsDifference=String(point.difference);pin.dataset.liveFresh=String(point.fresh);pin.classList.toggle('gps-crew-stale',!point.fresh||point.difference);pin.setAttribute('aria-label',title);signalBadge(pin.querySelector('.gps-age'),point);
     }
     reconcileNativeGps(t,p);
     const start=tripCarStartCoord(t);
     if(start){upsert('start',start,`<span class="gps-crew-start-label" role="img" aria-label="${escapeAttr(tr('Збережений старт'))}" title="${escapeAttr(tr('Збережений старт'))}">🏁</span>`,'start:'+lang(),'',[0,0],[35,-19],100);wanted.add('start');}
   }else{prior=null;oldCrew='';}
   for(const [key,rec] of markers)if(!wanted.has(key)){S.map.removeLayer(rec.marker);markers.delete(key);}
 }
 const original=renderCrewMembersOnMap;
 renderCrewMembersOnMap=function(){original();renderGpsLayer();};
 setInterval(renderGpsLayer,1000); // Local age/style only; no network or lifecycle writes.
})(typeof window!=='undefined'?window:{});
