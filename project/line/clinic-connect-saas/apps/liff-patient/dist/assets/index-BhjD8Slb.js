var D=(t,e)=>()=>(e||t((e={exports:{}}).exports,e),e.exports);var d=(t,e,n)=>new Promise((s,a)=>{var i=r=>{try{c(n.next(r))}catch(u){a(u)}},o=r=>{try{c(n.throw(r))}catch(u){a(u)}},c=r=>r.done?s(r.value):Promise.resolve(r.value).then(i,o);c((n=n.apply(t,e)).next())});import{l as v}from"./liff-O2FJu2J5.js";import{c as k}from"./supabase-Lfywt2aW.js";var ne=D(S=>{(function(){const e=document.createElement("link").relList;if(e&&e.supports&&e.supports("modulepreload"))return;for(const a of document.querySelectorAll('link[rel="modulepreload"]'))s(a);new MutationObserver(a=>{for(const i of a)if(i.type==="childList")for(const o of i.addedNodes)o.tagName==="LINK"&&o.rel==="modulepreload"&&s(o)}).observe(document,{childList:!0,subtree:!0});function n(a){const i={};return a.integrity&&(i.integrity=a.integrity),a.referrerPolicy&&(i.referrerPolicy=a.referrerPolicy),a.crossOrigin==="use-credentials"?i.credentials="include":a.crossOrigin==="anonymous"?i.credentials="omit":i.credentials="same-origin",i}function s(a){if(a.ep)return;a.ep=!0;const i=n(a);fetch(a.href,i)}})();const N="https://xklcronrzcervtjnodzs.supabase.co",H="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhrbGNyb25yemNlcnZ0am5vZHpzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk5MTU0ODAsImV4cCI6MjA4NTQ5MTQ4MH0.yY_Pcd9cC1JxzlEMO-_ZJIAlRMP0onl3VoXOZe_R39I",P="2009024944-uEXRao6i";let l=null,h="home",b=[];const m=k(N,H);function A(){return d(this,null,function*(){var t,e,n,s;try{if(yield v.init({liffId:P}),!v.isLoggedIn()){v.login();return}const a=v.getDecodedIDToken();if(l={userId:a.sub,displayName:a.name||"ผู้ใช้",pictureUrl:a.picture},(t=document.getElementById("loading-screen"))==null||t.classList.add("hidden"),(e=document.getElementById("main-app"))==null||e.classList.remove("hidden"),x(),!(yield G(l.userId))){f("register");return}yield $()}catch(a){console.error("LIFF initialization failed:",a),(n=document.getElementById("loading-screen"))==null||n.classList.add("hidden"),(s=document.getElementById("main-app"))==null||s.classList.remove("hidden"),p("ไม่สามารถเชื่อมต่อ LINE ได้ กรุณาลองใหม่","error"),l={userId:"demo-user",displayName:"ผู้ใช้ทดสอบ",pictureUrl:""},x()}})}function f(t){document.querySelectorAll(".page").forEach(n=>{n.classList.remove("active")});const e=document.getElementById(`page-${t}`);e&&e.classList.add("active"),h!==t&&b.push(h),h=t,O(t),U(t),window.scrollTo(0,0)}function C(){if(b.length>0){const t=b.pop()||"home";h=t,f(t),b.pop()}else f("home")}function O(t){document.querySelectorAll(".nav-item").forEach(e=>{e.getAttribute("data-page")===t?e.classList.add("active"):e.classList.remove("active")})}function x(){const t=document.getElementById("user-greeting");t&&l&&(t.textContent=`สวัสดี, ${l.displayName}`)}function p(t,e="success"){const n=document.createElement("div");n.className="toast-container";const s=document.createElement("div");s.className=`toast ${e}`,s.innerHTML=`<span>${t}</span>`,n.appendChild(s),document.body.appendChild(n),setTimeout(()=>{s.remove(),n.remove()},3e3)}function U(t){return d(this,null,function*(){switch(t){case"home":yield $();break;case"booking":yield z();break;case"queue":yield F();break;case"records":yield J();break;case"notifications":yield Z();break;case"profile":yield Q();break}})}function $(){return d(this,null,function*(){yield Promise.all([j(),T(),R()])})}function j(){return d(this,null,function*(){var e,n,s;const t=document.getElementById("next-appointment");if(t)try{const{data:a}=yield m.from("appointments").select(`
        appointment_id,
        appointment_date,
        appointment_time,
        queue_number,
        status,
        doctor:doctors(name, specialty)
      `).gte("appointment_date",new Date().toISOString().split("T")[0]).in("status",["pending","confirmed"]).order("appointment_date",{ascending:!0}).order("appointment_time",{ascending:!0}).limit(1);if(a&&a.length>0){const i=a[0];t.innerHTML=`
        <div class="appointment-info">
          <div class="appointment-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M22 12h-4l-3 9-9-5-2-3 3V4a2 2 0 01-2 2v2a2 2 0 012 2z" />
              <path d="M12 7v5a2 2 0 002 2" />
            </svg>
          </div>
          <div class="appointment-details">
            <div class="appointment-doctor">${((n=(e=i.doctor)==null?void 0:e[0])==null?void 0:n.name)||((s=i.doctor)==null?void 0:s.name)||"แพทย์"}</div>
            <div class="appointment-datetime">
              ${_(i.appointment_date)} · ${ee(i.appointment_time)}
            </div>
            <div class="appointment-queue">
              คิว: ${i.queue_number||"-"}
            </div>
          </div>
        </div>
      `}else t.innerHTML=`
        <div class="no-appointment">
          <p>ไม่มีนัดหมายที่กำลังจะถึง</p>
          <button class="btn btn-primary mt-sm" onclick="navigateTo('booking')">
            จองนัดหมาย
          </button>
        </div>
      `}catch(a){console.error("Error loading appointment:",a)}})}function T(){return d(this,null,function*(){var e,n,s;const t=document.getElementById("my-queue");if(t)try{const a=new Date().toISOString().split("T")[0],{data:i}=yield m.from("queue_management").select("*").eq("date",a).maybeSingle();if(!i){t.innerHTML='<div class="queue-placeholder"><p>ไม่มีคิววันนี้</p></div>';return}const{data:o}=yield m.from("appointments").select("queue_number, status, doctor:doctors(name)").eq("appointment_date",a).in("status",["confirmed","checked_in","in_consultation"]).maybeSingle();if(o){const c=Math.max(0,i.current_queue-o.queue_number),r=c*30;t.innerHTML=`
        <div class="queue-status">
          <div>
            <div class="text-muted text-sm">คิวของคุณ</div>
            <div class="queue-current">${o.queue_number||"-"}</div>
          </div>
          <div class="queue-waiting">
            <div class="queue-waiting-count">${c}</div>
            <div class="queue-waiting-label">รอ ${c} คน</div>
          </div>
        </div>
        <div class="queue-estimate">
          เวลารอคอยโดยประมาณ ~${r} นาที
          <br>
          <small>แพทย์: ${((n=(e=o.doctor)==null?void 0:e[0])==null?void 0:n.name)||((s=o.doctor)==null?void 0:s.name)||"-"}</small>
        </div>
      `}else t.innerHTML='<div class="queue-placeholder"><p>ไม่มีคิววันนี้</p></div>'}catch(a){console.error("Error loading queue:",a)}})}function R(){return d(this,null,function*(){const t=document.getElementById("news-list");if(t)try{const{data:e}=yield m.from("articles").select("article_id, title, excerpt, cover_image, created_at").eq("status","published").order("published_at",{ascending:!1,nullsFirst:!1}).limit(3);e&&e.length>0?t.innerHTML=e.map(n=>`
        <div class="news-item">
          <img
            src="${n.cover_image||"/placeholder-news.png"}"
            alt="${n.title}"
            class="news-image"
            onerror="this.src='/placeholder-news.png'"
          >
          <div class="news-content">
            <div class="news-title">${n.title}</div>
            <div class="news-meta">${_(n.created_at)}</div>
          </div>
        </div>
      `).join(""):t.innerHTML='<p class="text-muted text-center">ไม่มีข่าวสาร</p>'}catch(e){console.error("Error loading news:",e)}})}function z(){return d(this,null,function*(){const t=document.getElementById("doctor-select");if(t)try{const{data:e}=yield m.from("doctors").select("doctor_id, name, title, specialty").eq("is_available",!0).order("name");t.innerHTML='<option value="">-- กรุณาเลือกแพทย์ --</option>',e&&e.length>0&&e.forEach(n=>{const s=document.createElement("option");s.value=n.doctor_id,s.textContent=`${n.title||""} ${n.name}${n.specialty?` - ${n.specialty}`:""}`,t.appendChild(s)}),X(),t.addEventListener("change",Y)}catch(e){console.error("Error loading doctors:",e)}})}function F(){return d(this,null,function*(){yield T()})}function J(){return d(this,null,function*(){const t=document.getElementById("records-list");if(t)try{const{data:e}=yield m.from("medical_records").select(`
        record_id,
        created_at,
        diagnosis,
        treatment_plan,
        prescription,
        doctor:doctors(name, title),
        appointment:appointments(appointment_date)
      `).order("created_at",{ascending:!1}).limit(10);e&&e.length>0?t.innerHTML=e.map(n=>{var s,a,i,o,c,r;return`
        <div class="card mb-md">
          <div class="card-body">
            <div class="flex justify-between mb-sm">
              <strong>${((a=(s=n.doctor)==null?void 0:s[0])==null?void 0:a.title)||((i=n.doctor)==null?void 0:i.title)||""} ${((c=(o=n.doctor)==null?void 0:o[0])==null?void 0:c.name)||((r=n.doctor)==null?void 0:r.name)||"แพทย์"}</strong>
              <span class="text-muted">${_(n.created_at)}</span>
            </div>
            <div class="mb-sm">
              <span class="text-muted">วินิจฉัย:</span>
              <p>${n.diagnosis||"-"}</p>
            </div>
            <div class="mb-sm">
              <span class="text-muted">การรักษา:</span>
              <p>${n.treatment_plan||"-"}</p>
            </div>
            <div>
              <span class="text-muted">ยา:</span>
              <p>${n.prescription||"-"}</p>
            </div>
          </div>
        </div>
      `}).join(""):t.innerHTML=`
        <div class="text-center p-lg">
          <p class="text-muted">ไม่พบประวัติการรักษา</p>
        </div>
      `}catch(e){console.error("Error loading records:",e)}})}function Z(){return d(this,null,function*(){const t=document.getElementById("notifications-list");if(!(!t||!l))try{const{data:e}=yield m.from("notifications").select("*").eq("user_id",l.userId).order("created_at",{ascending:!1}).limit(20);e&&e.length>0?t.innerHTML=e.map(n=>`
        <div class="card mb-sm ${n.is_read?"":"unread"}">
          <div class="card-body">
            <div class="font-semibold mb-sm">${n.title||"แจ้งเตือน"}</div>
            <p class="text-muted">${n.message}</p>
            <span class="text-xs text-muted">${te(n.created_at)}</span>
          </div>
        </div>
      `).join(""):t.innerHTML=`
        <div class="text-center p-lg">
          <p class="text-muted">ไม่มีการแจ้งเตือน</p>
        </div>
      `}catch(e){console.error("Error loading notifications:",e)}})}function Q(){return d(this,null,function*(){const t=document.getElementById("profile-card");if(!(!t||!l))try{const{data:e}=yield m.from("patients").select("*").eq("user_id",l.userId).maybeSingle();t.innerHTML=`
      <div class="text-center mb-lg">
        <img
          src="${l.pictureUrl||"/placeholder-avatar.png"}"
          alt="${l.displayName}"
          class="profile-avatar"
          onerror="this.src='/placeholder-avatar.png'"
          style="width: 100px; height: 100px; border-radius: 50%; object-fit: cover;"
        >
        <h2 class="mt-md">${(e==null?void 0:e.name)||l.displayName}</h2>
        <p class="text-muted">${(e==null?void 0:e.phone)||""}</p>
      </div>

      <div class="card">
        <div class="card-body">
          <div class="mb-md">
            <label class="text-muted text-sm">วันเกิด</label>
            <p>${e!=null&&e.date_of_birth?_(e.date_of_birth):"-"}</p>
          </div>
          <div class="mb-md">
            <label class="text-muted text-sm">กรุ๊ปเลือด</label>
            <p>${(e==null?void 0:e.gender)||"-"}</p>
          </div>
          <div class="mb-md">
            <label class="text-muted text-sm">โรคประจำตัว</label>
            <p>${(e==null?void 0:e.chronic_diseases)||"-"}</p>
          </div>
          <div class="mb-md">
            <label class="text-muted text-sm">ประวัติแพ้ยา</label>
            <p>${(e==null?void 0:e.allergies)||"-"}</p>
          </div>
        </div>
      </div>

      <button class="btn btn-outline" style="width: 100%; margin-top: var(--spacing-md);">
        แก้ไขข้อมูล
      </button>
    `}catch(e){console.error("Error loading profile:",e)}})}function X(){const t=document.getElementById("date-selector");if(!t)return;const e=["อา","จ","อ","พ","พฤ","ศ","ส"],n=new Date,s=[];for(let a=0;a<14;a++){const i=new Date(n);i.setDate(n.getDate()+a),s.push(i)}t.innerHTML=s.map(a=>{const i=a.toISOString().split("T")[0],o=e[a.getDay()],c=a.getDate(),r=a.getDay()===0||a.getDay()===6;return`
      <button
        type="button"
        class="date-btn ${r?"weekend":""}"
        data-date="${i}"
        ${r?"disabled":""}
        onclick="selectDate('${i}')"
      >
        <span class="date-day">${o}</span>
        <span class="date-number">${c}</span>
      </button>
    `}).join("")}window.selectDate=t=>d(S,null,function*(){document.querySelectorAll(".date-btn").forEach(n=>{n.classList.remove("selected"),n.getAttribute("data-date")===t&&n.classList.add("selected")});const e=document.getElementById("selected-date");e&&(e.value=t),yield q(t)});function q(t){return d(this,null,function*(){const e=document.getElementById("time-selector"),n=document.getElementById("doctor-select");if(!e||!n)return;const s=n.value;if(!s){e.innerHTML='<p class="text-muted">กรุณาเลือกแพทย์ก่อน</p>';return}try{const{data:a}=yield m.from("doctors").select("available_time_start, available_time_end, appointment_duration_minutes").eq("doctor_id",s).maybeSingle(),i=(a==null?void 0:a.available_time_start)||"09:00",o=(a==null?void 0:a.available_time_end)||"17:00",c=(a==null?void 0:a.appointment_duration_minutes)||30,r=V(i,o,c),{data:u}=yield m.from("appointment_slots").select("start_time").eq("doctor_id",s).eq("date",t).eq("is_available",!1),w=new Set((u==null?void 0:u.map(g=>g.start_time))||[]);e.innerHTML=r.map(g=>{const y=w.has(g);return`
        <button
          type="button"
          class="time-btn"
          data-time="${g}"
          ${y?"disabled":""}
          onclick="selectTime('${g}')"
        >
          ${g}
        </button>
      `}).join("")}catch(a){console.error("Error loading time slots:",a)}})}function V(t,e,n){const s=[];let[a,i]=t.split(":").map(Number);const[o,c]=e.split(":").map(Number);for(;a<o||a===o&&i<c;){const r=`${String(a).padStart(2,"0")}:${String(i).padStart(2,"0")}`;s.push(r),i+=n,i>=60&&(a+=Math.floor(i/60),i=i%60)}return s}window.selectTime=t=>{document.querySelectorAll(".time-btn").forEach(n=>{n.classList.remove("selected"),n.getAttribute("data-time")===t&&n.classList.add("selected")});const e=document.getElementById("selected-time");e&&(e.value=t)};function Y(){return d(this,null,function*(){const t=document.getElementById("selected-date");t.value&&(yield q(t.value))})}function G(t){return d(this,null,function*(){try{const{data:e}=yield m.from("users").select("user_id").eq("line_user_id",t).maybeSingle();if(e){const{data:n}=yield m.from("patients").select("*").eq("user_id",e.user_id).maybeSingle();return n}return null}catch(e){return console.error("Error checking registration:",e),null}})}function K(t){return d(this,null,function*(){if(t.preventDefault(),!l){p("ไม่พบข้อมูลผู้ใช้","error");return}const e=document.getElementById("reg-phone"),n=document.getElementById("reg-id-card"),s=document.getElementById("reg-name"),a=document.getElementById("reg-dob"),i=document.getElementById("reg-chronic"),o=document.getElementById("reg-allergies"),c=document.querySelector('input[name="reg-gender"]:checked');if(!e.value||!n.value||!s.value){p("กรุณากรอกข้อมูลให้ครบถ้วน","warning");return}const r=/^0[0-9]{8,9}$/,u=e.value.replace(/-/g,"");if(!r.test(u)){p("กรุณากรอกเบอร์โทรศัพท์ให้ถูกต้อง","warning");return}const w=/^[0-9]{13}$/,g=n.value.replace(/-/g,"");if(!w.test(g)){p("กรุณากรอกเลขบัตรประชาชน 13 หลัก","warning");return}try{const{data:y}=yield m.from("patients").select("patient_id").eq("id_card_number",g).maybeSingle();if(y){p("เลขบัตรประชาชนนี้ได้ถูกลงทะเบียนแล้ว","error");return}let I;const{data:L}=yield m.from("users").select("user_id").eq("line_user_id",l.userId).maybeSingle();if(L)I=L.user_id;else{const{data:M,error:B}=yield m.from("users").insert({line_user_id:l.userId,display_name:l.displayName,picture_url:l.pictureUrl,phone:u,role:"patient"}).select("user_id").single();B?console.warn("Could not create user record, proceeding with patient only:",B):I=M.user_id}const{data:ae,error:E}=yield m.from("patients").insert({user_id:I,clinic_id:"00000000-0000-0000-0000-000000000001",phone:u,id_card_number:g,name:s.value.trim(),date_of_birth:a.value||null,gender:(c==null?void 0:c.value)||null,chronic_diseases:(i==null?void 0:i.value.trim())||null,allergies:(o==null?void 0:o.value.trim())||null,first_visit_date:new Date().toISOString().split("T")[0]}).select().single();if(E)throw console.error("Patient insert error:",E),E;p("ลงทะเบียนสำเร็จ","success"),document.getElementById("registration-form").reset(),f("home"),yield $()}catch(y){console.error("Registration error:",y),p("ไม่สามารถลงทะเบียนได้ กรุณาลองใหม่","error")}})}window.cancelRegistration=function(){confirm("คุณต้องการยกเลิกการลงทะเบียนใช่หรือไม่?")&&(v.isInClient()?v.closeWindow():f("home"))};function W(t){return d(this,null,function*(){t.preventDefault();const e=document.getElementById("doctor-select"),n=document.getElementById("selected-date"),s=document.getElementById("selected-time"),a=document.getElementById("symptoms");if(!e.value||!n.value||!s.value){p("กรุณากรอกข้อมูลให้ครบถ้วน","warning");return}try{const{data:i,error:o}=yield m.from("appointments").insert({clinic_id:"00000000-0000-0000-0000-000000000001",patient_id:null,doctor_id:e.value,appointment_date:n.value,appointment_time:s,symptoms:a.value,status:"pending"}).select().single();if(o)throw o;p("จองนัดหมายสำเร็จ","success"),document.getElementById("booking-form").reset(),f("home")}catch(i){console.error("Booking error:",i),p("ไม่สามารถจองนัดหมายได้","error")}})}function _(t){const e=new Date(t),n={year:"numeric",month:"short",day:"numeric"};return e.toLocaleDateString("th-TH",n)}function ee(t){const[e,n]=t.split(":");return`${e}:${n}`}function te(t){const e=new Date(t),n={year:"numeric",month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"};return e.toLocaleDateString("th-TH",n)}document.addEventListener("DOMContentLoaded",()=>{A();const t=document.getElementById("booking-form");t&&t.addEventListener("submit",W);const e=document.getElementById("registration-form");e&&e.addEventListener("submit",K)});window.navigateTo=f;window.navigateBack=C});export default ne();
//# sourceMappingURL=index-BhjD8Slb.js.map
