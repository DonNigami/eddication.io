var q=(t,e)=>()=>(e||t((e={exports:{}}).exports,e),e.exports);var s=(t,e,n)=>new Promise((o,i)=>{var a=d=>{try{l(n.next(d))}catch(p){i(p)}},r=d=>{try{l(n.throw(d))}catch(p){i(p)}},l=d=>d.done?o(d.value):Promise.resolve(d.value).then(a,r);l((n=n.apply(t,e)).next())});import{l as g}from"./liff-O2FJu2J5.js";import{c as L}from"./supabase-Lfywt2aW.js";var Q=q(y=>{(function(){const e=document.createElement("link").relList;if(e&&e.supports&&e.supports("modulepreload"))return;for(const i of document.querySelectorAll('link[rel="modulepreload"]'))o(i);new MutationObserver(i=>{for(const a of i)if(a.type==="childList")for(const r of a.addedNodes)r.tagName==="LINK"&&r.rel==="modulepreload"&&o(r)}).observe(document,{childList:!0,subtree:!0});function n(i){const a={};return i.integrity&&(a.integrity=i.integrity),i.referrerPolicy&&(a.referrerPolicy=i.referrerPolicy),i.crossOrigin==="use-credentials"?a.credentials="include":i.crossOrigin==="anonymous"?a.credentials="omit":a.credentials="same-origin",a}function o(i){if(i.ep)return;i.ep=!0;const a=n(i);fetch(i.href,a)}})();const S="https://xklcronrzcervtjnodzs.supabase.co",B="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhrbGNyb25yemNlcnZ0am5vZHpzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk5MTU0ODAsImV4cCI6MjA4NTQ5MTQ4MH0.yY_Pcd9cC1JxzlEMO-_ZJIAlRMP0onl3VoXOZe_R39I",D="2009024944-uEXRao6i";let c=null,f="dashboard",_=[];const u=L(S,B);function C(){return s(this,null,function*(){var t,e;try{if(yield g.init({liffId:D}),!g.isLoggedIn()){g.login();return}const n=g.getDecodedIDToken();(t=document.getElementById("loading-screen"))==null||t.classList.add("hidden"),(e=document.getElementById("main-app"))==null||e.classList.remove("hidden"),yield T(n.sub),yield w()}catch(n){console.error("LIFF initialization failed:",n),m("ไม่สามารถเริ่มแอปได้","error")}})}function T(t){return s(this,null,function*(){try{const{data:e}=yield u.from("doctors").select("*, clinic_id").eq("user_id",t).single();e?(c=e,O()):m("ไม่พบข้อมูลแพทย์","error")}catch(e){console.error("Error loading doctor profile:",e)}})}function O(){const t=document.getElementById("user-greeting");t&&c&&(t.textContent=`👨‍⚕️ ${c.title||""} ${c.name}`)}function b(t){document.querySelectorAll(".page").forEach(n=>{n.classList.remove("active")});const e=document.getElementById(`page-${t}`);e&&e.classList.add("active"),f!==t&&_.push(f),f=t,x(t),v(t),window.scrollTo(0,0)}function I(){if(_.length>0){const t=_.pop()||"dashboard";f=t,b(t),_.pop()}else b("dashboard")}function x(t){document.querySelectorAll(".nav-item").forEach(e=>{e.getAttribute("data-page")===t?e.classList.add("active"):e.classList.remove("active")})}function v(t){return s(this,null,function*(){switch(t){case"dashboard":yield w();break;case"queue":yield M();break;case"patients":yield P();break;case"schedule":yield A();break}})}function w(){return s(this,null,function*(){if(!c)return;const t=new Date().toISOString().split("T")[0];try{const{data:e}=yield u.from("queue_management").select("*").eq("doctor_id",c.doctor_id).eq("date",t).single(),{data:n}=yield u.from("appointments").select(`
        appointment_id,
        queue_number,
        status,
        patient:patients(name, phone),
        appointment_time
      `).eq("doctor_id",c.doctor_id).eq("appointment_date",t).in("status",["confirmed","checked_in","in_consultation"]).order("appointment_time");document.getElementById("stat-today-patients").textContent=(e==null?void 0:e.waiting_count)||0,document.getElementById("stat-waiting").textContent=(e==null?void 0:e.waiting_count)||0,document.getElementById("stat-completed").textContent=(e==null?void 0:e.completed_count)||0,document.getElementById("stat-rating").textContent=`⭐ ${c.rating_average||0}`;const o=document.getElementById("dashboard-queue-list");o&&(n&&n.length>0?o.innerHTML=n.slice(0,5).map(i=>{var a,r,l,d,p,h;return`
          <div class="queue-item ${i.status==="in_consultation"?"active":""}" data-id="${i.appointment_id}">
            <div class="queue-item-header">
              <span class="queue-number">คิว ${i.queue_number}</span>
              <span class="queue-status status-${i.status}">${k(i.status)}</span>
            </div>
            <div class="queue-item-body">
              <div class="patient-name">${((r=(a=i.patient)==null?void 0:a[0])==null?void 0:r.name)||((l=i.patient)==null?void 0:l.name)||"-"}</div>
              <div class="patient-phone">${((p=(d=i.patient)==null?void 0:d[0])==null?void 0:p.phone)||((h=i.patient)==null?void 0:h.phone)||""}</div>
            </div>
            <div class="queue-item-actions">
              ${i.status==="confirmed"||i.status==="checked_in"?`
                <button class="btn-sm btn-primary" onclick="startConsultation('${i.appointment_id}')">เรียกเข้าพบ</button>
                <button class="btn-sm btn-outline" onclick="openDiagnosis('${i.appointment_id}')">บันทึก</button>
              `:""}
              ${i.status==="in_consultation"?`
                <button class="btn-sm btn-success" onclick="completeConsultation('${i.appointment_id}')">เสร็จสิ้น</button>
              `:""}
            </div>
          </div>
        `}).join(""):o.innerHTML='<p class="text-muted text-center py-4">ไม่มีคิววันนี้</p>')}catch(e){console.error("Error loading dashboard:",e)}})}function M(){return s(this,null,function*(){if(!c)return;const t=new Date().toISOString().split("T")[0],e=document.getElementById("queue-list");try{const{data:n}=yield u.from("appointments").select(`
        appointment_id,
        queue_number,
        status,
        patient:patients(name, phone),
        appointment_time,
        symptoms
      `).eq("doctor_id",c.doctor_id).eq("appointment_date",t).order("queue_number");e&&(n&&n.length>0?e.innerHTML=n.map(o=>{var i,a,r,l,d,p;return`
          <div class="queue-item-full">
            <div class="queue-item-full-header">
              <div class="queue-number-large">A${o.queue_number}</div>
              <div class="queue-info">
                <div class="patient-name">${((a=(i=o.patient)==null?void 0:i[0])==null?void 0:a.name)||((r=o.patient)==null?void 0:r.name)||"-"}</div>
                <div class="patient-phone">${((d=(l=o.patient)==null?void 0:l[0])==null?void 0:d.phone)||((p=o.patient)==null?void 0:p.phone)||""}</div>
                ${o.symptoms?`<div class="symptoms text-muted">อาการ: ${o.symptoms}</div>`:""}
              </div>
              <div class="queue-status-badge status-${o.status}">
                ${k(o.status)}
              </div>
            </div>
            <div class="queue-item-full-actions">
              ${o.status==="confirmed"?`
                <button class="btn btn-outline" onclick="callQueue('${o.appointment_id}')">🔔 เรียกคิว</button>
                <button class="btn btn-primary" onclick="openDiagnosis('${o.appointment_id}')">📝 บันทึก</button>
              `:""}
              ${o.status==="checked_in"?`
                <button class="btn btn-success" onclick="startConsultation('${o.appointment_id}')">เรียกเข้าพบ</button>
              `:""}
              ${o.status==="in_consultation"?`
                <button class="btn btn-success" onclick="completeConsultation('${o.appointment_id}')">✅ เสร็จสิ้น</button>
              `:""}
            </div>
          </div>
        `}).join(""):e.innerHTML='<p class="text-muted text-center py-8">ไม่มีคิววันนี้</p>')}catch(n){console.error("Error loading queue:",n)}})}function P(){return s(this,null,function*(){const t=document.getElementById("patients-list");if(!(!t||!c))try{const{data:e}=yield u.from("patients").select("*").eq("clinic_id",c.clinic_id).order("last_visit_date",{ascending:!1,nullsFirst:!1}).limit(50);t&&(e&&e.length>0?t.innerHTML=e.map(n=>`
          <div class="patient-item" onclick="openPatientDetail('${n.patient_id}')">
            <div class="patient-item-header">
              <div class="patient-name">${n.name}</div>
              <div class="patient-visits">เคยมา ${n.total_visits} ครั้ง</div>
            </div>
            <div class="patient-item-body">
              <div class="patient-phone">📱 ${n.phone}</div>
              ${n.chronic_diseases?`<div class="patient-conditions">โรคประจำตัว: ${n.chronic_diseases}</div>`:""}
            </div>
          </div>
        `).join(""):t.innerHTML='<p class="text-muted text-center py-8">ไม่พบข้อมูลคนไข้</p>')}catch(e){console.error("Error loading patients:",e)}})}function A(){return s(this,null,function*(){if(c)try{const{data:t}=yield u.from("doctors").select("*").eq("doctor_id",c.doctor_id).single();if(t){const e=document.getElementById("schedule-start"),n=document.getElementById("schedule-end"),o=document.getElementById("schedule-duration"),i=document.getElementById("schedule-break-start"),a=document.getElementById("schedule-break-end");e&&(e.value=t.available_time_start||"09:00"),n&&(n.value=t.available_time_end||"17:00"),o&&(o.value=t.appointment_duration_minutes||30),i&&(i.value=t.break_start_time||"12:00"),a&&(a.value=t.break_end_time||"13:00");const r=t.available_days||[1,2,3,4,5];document.querySelectorAll(".day-checkbox input").forEach(l=>{l.checked=r.includes(parseInt(l.value))}),yield N()}}catch(t){console.error("Error loading schedule:",t)}})}function N(){return s(this,null,function*(){if(!c)return;const t=document.getElementById("blocked-dates");if(t)try{const{data:e}=yield u.from("doctor_blocked_dates").select("*").eq("doctor_id",c.doctor_id).gte("block_date",new Date().toISOString().split("T")[0]).order("block_date").limit(10);t&&(e&&e.length>0?t.innerHTML=e.map(n=>`
          <div class="blocked-date-item">
            <span>${J(n.block_date)}</span>
            <span class="text-muted">${n.reason||n.block_type}</span>
            <button class="text-btn text-error" onclick="unblockDate('${n.block_id}')">ยกเลิก</button>
          </div>
        `).join(""):t.innerHTML='<p class="text-muted text-sm">ไม่มีวันหยุก</p>')}catch(e){console.error("Error loading blocked dates:",e)}})}function H(t){return s(this,null,function*(){try{yield u.from("appointments").update({status:"checked_in",check_in_time:new Date().toISOString()}).eq("appointment_id",t),yield E("checked_in"),m("เรียกคิวแล้ว"),yield v(f)}catch(e){console.error("Error calling queue:",e),m("ไม่สามารถเรียกคิวได้","error")}})}function F(t){return s(this,null,function*(){try{yield u.from("appointments").update({status:"in_consultation",start_time:new Date().toISOString()}).eq("appointment_id",t),m("เริ่มตรวจแล้ว"),$(t),yield v(f)}catch(e){console.error("Error starting consultation:",e),m("ไม่สามารถเริ่มตรวจได้","error")}})}function j(t){return s(this,null,function*(){try{yield u.from("appointments").update({status:"completed",end_time_actual:new Date().toISOString()}).eq("appointment_id",t),yield E("completed"),m("เสร็จสิ้นแล้ว"),yield v(f)}catch(e){console.error("Error completing consultation:",e),m("ไม่สามารถบันทึกได้","error")}})}function E(t){return s(this,null,function*(){if(!c)return;const e=new Date().toISOString().split("T")[0];new Date().toISOString(),t==="checked_in"&&new Date().toISOString(),yield u.rpc("increment_queue_stat",{p_doctor_id:c.doctor_id,p_date:e,p_stat_type:t})})}function $(t){return s(this,null,function*(){yield z(t),b("diagnosis")})}function z(t){return s(this,null,function*(){var e;try{const{data:n}=yield u.from("appointments").select(`
        patient:patients(name, phone, date_of_birth),
        appointment_time,
        symptoms
      `).eq("appointment_id",t).single();if(n){const o=document.getElementById("diagnosis-patient-name"),i=document.getElementById("diagnosis-patient-info"),a=((e=n.patient)==null?void 0:e[0])||n.patient;o&&(o.textContent=(a==null?void 0:a.name)||"-"),i&&(i.textContent=`เบอร์: ${(a==null?void 0:a.phone)||"-"} | เวลานัด: ${n.appointment_time}`);const r=document.getElementById("diagnosis-subj");r&&(r.value=n.symptoms||"")}}catch(n){console.error("Error loading diagnosis details:",n)}})}function k(t){return{pending:"รอยืนยัน",confirmed:"ยืนยัน",checked_in:"เช็คอิน",in_consultation:"กำลังตรวจ",completed:"เสร็จสิ้น",cancelled:"ยกเลิก",no_show:"ไม่มา"}[t]||t}function J(t){return new Date(t).toLocaleDateString("th-TH",{year:"numeric",month:"short",day:"numeric"})}function m(t,e="success"){const n=document.createElement("div");n.className="toast-container";const o=document.createElement("div");o.className=`toast ${e}`,o.innerHTML=`<span>${t}</span>`,n.appendChild(o),document.body.appendChild(n),setTimeout(()=>{o.remove(),n.remove()},3e3)}window.navigateTo=b;window.navigateBack=I;window.callQueue=H;window.startConsultation=F;window.completeConsultation=j;window.openDiagnosis=$;document.addEventListener("DOMContentLoaded",()=>{C();const t=document.getElementById("schedule-form");t&&t.addEventListener("submit",o=>s(y,null,function*(){o.preventDefault(),m("บันทึกเวลาว่างสำเร็จ")}));const e=document.getElementById("diagnosis-form");e&&e.addEventListener("submit",o=>s(y,null,function*(){o.preventDefault(),m("บันทึกการรักษาสำเร็จ"),I()}));const n=document.getElementById("patient-search");n&&n.addEventListener("input",o=>s(y,null,function*(){o.target.value}))})});export default Q();
//# sourceMappingURL=index-CMiPeaP0.js.map
