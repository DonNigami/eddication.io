var P=(t,e)=>()=>(e||t((e={exports:{}}).exports,e),e.exports);var d=(t,e,n)=>new Promise((o,a)=>{var i=r=>{try{c(n.next(r))}catch(u){a(u)}},s=r=>{try{c(n.throw(r))}catch(u){a(u)}},c=r=>r.done?o(r.value):Promise.resolve(r.value).then(i,s);c((n=n.apply(t,e)).next())});import{l as v}from"./liff-O2FJu2J5.js";import{c as A}from"./supabase-Lfywt2aW.js";var oe=P(N=>{(function(){const e=document.createElement("link").relList;if(e&&e.supports&&e.supports("modulepreload"))return;for(const a of document.querySelectorAll('link[rel="modulepreload"]'))o(a);new MutationObserver(a=>{for(const i of a)if(i.type==="childList")for(const s of i.addedNodes)s.tagName==="LINK"&&s.rel==="modulepreload"&&o(s)}).observe(document,{childList:!0,subtree:!0});function n(a){const i={};return a.integrity&&(i.integrity=a.integrity),a.referrerPolicy&&(i.referrerPolicy=a.referrerPolicy),a.crossOrigin==="use-credentials"?i.credentials="include":a.crossOrigin==="anonymous"?i.credentials="omit":i.credentials="same-origin",i}function o(a){if(a.ep)return;a.ep=!0;const i=n(a);fetch(a.href,i)}})();const C="https://xklcronrzcervtjnodzs.supabase.co",O="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhrbGNyb25yemNlcnZ0am5vZHpzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk5MTU0ODAsImV4cCI6MjA4NTQ5MTQ4MH0.yY_Pcd9cC1JxzlEMO-_ZJIAlRMP0onl3VoXOZe_R39I",T="2009024944-uEXRao6i";let l=null,b="home",w=[];const m=A(C,O);function h(){let t=document.getElementById("loading-screen");if(!t&&window.parent!==window)try{t=window.parent.document.getElementById("loading-screen")}catch(n){}t&&t.classList.add("hidden"),document.querySelectorAll(".loading-screen").forEach(n=>n.classList.add("hidden"))}function _(){const t=document.getElementById("main-app");t&&t.classList.remove("hidden")}function U(){return d(this,null,function*(){const t=setTimeout(()=>{console.warn("LIFF initialization timeout - showing app anyway"),h(),_()},5e3);try{const e=v.isInClient();if(yield v.init({liffId:T}),clearTimeout(t),!v.isLoggedIn()){console.warn("User not logged in - running in demo mode"),h(),_(),q();return}const n=v.getDecodedIDToken();if(l={userId:n.sub,displayName:n.name||"ผู้ใช้",pictureUrl:n.picture},h(),_(),M(),!(yield ee(l.userId))){f("register");return}yield S()}catch(e){console.error("LIFF initialization failed:",e),clearTimeout(t),h(),_(),p("ไม่สามารถเชื่อมต่อ LINE ได้ กรุณาลองใหม่","error"),q()}})}function q(){l={userId:"demo-user",displayName:"ผู้ใช้ทดสอบ",pictureUrl:""},M()}function f(t){document.querySelectorAll(".page").forEach(n=>{n.classList.remove("active")});const e=document.getElementById(`page-${t}`);e&&e.classList.add("active"),b!==t&&w.push(b),b=t,R(t),j(t),window.scrollTo(0,0)}function F(){if(w.length>0){const t=w.pop()||"home";b=t,f(t),w.pop()}else f("home")}function R(t){document.querySelectorAll(".nav-item").forEach(e=>{e.getAttribute("data-page")===t?e.classList.add("active"):e.classList.remove("active")})}function M(){const t=document.getElementById("user-greeting");t&&l&&(t.textContent=`สวัสดี, ${l.displayName}`)}function p(t,e="success"){const n=document.createElement("div");n.className="toast-container";const o=document.createElement("div");o.className=`toast ${e}`,o.innerHTML=`<span>${t}</span>`,n.appendChild(o),document.body.appendChild(n),setTimeout(()=>{o.remove(),n.remove()},3e3)}function j(t){return d(this,null,function*(){switch(t){case"home":yield S();break;case"booking":yield Z();break;case"queue":yield Q();break;case"records":yield X();break;case"notifications":yield Y();break;case"profile":yield V();break}})}function S(){return d(this,null,function*(){yield Promise.all([z(),D(),J()])})}function z(){return d(this,null,function*(){var e,n,o;const t=document.getElementById("next-appointment");if(t)try{const{data:a}=yield m.from("appointments").select(`
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
            <div class="appointment-doctor">${((n=(e=i.doctor)==null?void 0:e[0])==null?void 0:n.name)||((o=i.doctor)==null?void 0:o.name)||"แพทย์"}</div>
            <div class="appointment-datetime">
              ${I(i.appointment_date)} · ${ae(i.appointment_time)}
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
      `}catch(a){console.error("Error loading appointment:",a)}})}function D(){return d(this,null,function*(){var e,n,o;const t=document.getElementById("my-queue");if(t)try{const a=new Date().toISOString().split("T")[0],{data:i}=yield m.from("queue_management").select("*").eq("date",a).maybeSingle();if(!i){t.innerHTML='<div class="queue-placeholder"><p>ไม่มีคิววันนี้</p></div>';return}const{data:s}=yield m.from("appointments").select("queue_number, status, doctor:doctors(name)").eq("appointment_date",a).in("status",["confirmed","checked_in","in_consultation"]).maybeSingle();if(s){const c=Math.max(0,i.current_queue-s.queue_number),r=c*30;t.innerHTML=`
        <div class="queue-status">
          <div>
            <div class="text-muted text-sm">คิวของคุณ</div>
            <div class="queue-current">${s.queue_number||"-"}</div>
          </div>
          <div class="queue-waiting">
            <div class="queue-waiting-count">${c}</div>
            <div class="queue-waiting-label">รอ ${c} คน</div>
          </div>
        </div>
        <div class="queue-estimate">
          เวลารอคอยโดยประมาณ ~${r} นาที
          <br>
          <small>แพทย์: ${((n=(e=s.doctor)==null?void 0:e[0])==null?void 0:n.name)||((o=s.doctor)==null?void 0:o.name)||"-"}</small>
        </div>
      `}else t.innerHTML='<div class="queue-placeholder"><p>ไม่มีคิววันนี้</p></div>'}catch(a){console.error("Error loading queue:",a)}})}function J(){return d(this,null,function*(){const t=document.getElementById("news-list");if(t)try{const{data:e}=yield m.from("articles").select("article_id, title, excerpt, cover_image, created_at").eq("status","published").order("published_at",{ascending:!1,nullsFirst:!1}).limit(3);e&&e.length>0?t.innerHTML=e.map(n=>`
        <div class="news-item">
          <img
            src="${n.cover_image||"/placeholder-news.png"}"
            alt="${n.title}"
            class="news-image"
            onerror="this.src='/placeholder-news.png'"
          >
          <div class="news-content">
            <div class="news-title">${n.title}</div>
            <div class="news-meta">${I(n.created_at)}</div>
          </div>
        </div>
      `).join(""):t.innerHTML='<p class="text-muted text-center">ไม่มีข่าวสาร</p>'}catch(e){console.error("Error loading news:",e)}})}function Z(){return d(this,null,function*(){const t=document.getElementById("doctor-select");if(t)try{const{data:e}=yield m.from("doctors").select("doctor_id, name, title, specialty").eq("is_available",!0).order("name");t.innerHTML='<option value="">-- กรุณาเลือกแพทย์ --</option>',e&&e.length>0&&e.forEach(n=>{const o=document.createElement("option");o.value=n.doctor_id,o.textContent=`${n.title||""} ${n.name}${n.specialty?` - ${n.specialty}`:""}`,t.appendChild(o)}),G(),t.addEventListener("change",W)}catch(e){console.error("Error loading doctors:",e)}})}function Q(){return d(this,null,function*(){yield D()})}function X(){return d(this,null,function*(){const t=document.getElementById("records-list");if(t)try{const{data:e}=yield m.from("medical_records").select(`
        record_id,
        created_at,
        diagnosis,
        treatment_plan,
        prescription,
        doctor:doctors(name, title),
        appointment:appointments(appointment_date)
      `).order("created_at",{ascending:!1}).limit(10);e&&e.length>0?t.innerHTML=e.map(n=>{var o,a,i,s,c,r;return`
        <div class="card mb-md">
          <div class="card-body">
            <div class="flex justify-between mb-sm">
              <strong>${((a=(o=n.doctor)==null?void 0:o[0])==null?void 0:a.title)||((i=n.doctor)==null?void 0:i.title)||""} ${((c=(s=n.doctor)==null?void 0:s[0])==null?void 0:c.name)||((r=n.doctor)==null?void 0:r.name)||"แพทย์"}</strong>
              <span class="text-muted">${I(n.created_at)}</span>
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
      `}catch(e){console.error("Error loading records:",e)}})}function Y(){return d(this,null,function*(){const t=document.getElementById("notifications-list");if(!(!t||!l))try{const{data:e}=yield m.from("notifications").select("*").eq("user_id",l.userId).order("created_at",{ascending:!1}).limit(20);e&&e.length>0?t.innerHTML=e.map(n=>`
        <div class="card mb-sm ${n.is_read?"":"unread"}">
          <div class="card-body">
            <div class="font-semibold mb-sm">${n.title||"แจ้งเตือน"}</div>
            <p class="text-muted">${n.message}</p>
            <span class="text-xs text-muted">${ie(n.created_at)}</span>
          </div>
        </div>
      `).join(""):t.innerHTML=`
        <div class="text-center p-lg">
          <p class="text-muted">ไม่มีการแจ้งเตือน</p>
        </div>
      `}catch(e){console.error("Error loading notifications:",e)}})}function V(){return d(this,null,function*(){const t=document.getElementById("profile-card");if(!(!t||!l))try{const{data:e}=yield m.from("patients").select("*").eq("user_id",l.userId).maybeSingle();t.innerHTML=`
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
            <p>${e!=null&&e.date_of_birth?I(e.date_of_birth):"-"}</p>
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
    `}catch(e){console.error("Error loading profile:",e)}})}function G(){const t=document.getElementById("date-selector");if(!t)return;const e=["อา","จ","อ","พ","พฤ","ศ","ส"],n=new Date,o=[];for(let a=0;a<14;a++){const i=new Date(n);i.setDate(n.getDate()+a),o.push(i)}t.innerHTML=o.map(a=>{const i=a.toISOString().split("T")[0],s=e[a.getDay()],c=a.getDate(),r=a.getDay()===0||a.getDay()===6;return`
      <button
        type="button"
        class="date-btn ${r?"weekend":""}"
        data-date="${i}"
        ${r?"disabled":""}
        onclick="selectDate('${i}')"
      >
        <span class="date-day">${s}</span>
        <span class="date-number">${c}</span>
      </button>
    `}).join("")}window.selectDate=t=>d(N,null,function*(){document.querySelectorAll(".date-btn").forEach(n=>{n.classList.remove("selected"),n.getAttribute("data-date")===t&&n.classList.add("selected")});const e=document.getElementById("selected-date");e&&(e.value=t),yield k(t)});function k(t){return d(this,null,function*(){const e=document.getElementById("time-selector"),n=document.getElementById("doctor-select");if(!e||!n)return;const o=n.value;if(!o){e.innerHTML='<p class="text-muted">กรุณาเลือกแพทย์ก่อน</p>';return}try{const{data:a}=yield m.from("doctors").select("available_time_start, available_time_end, appointment_duration_minutes").eq("doctor_id",o).maybeSingle(),i=(a==null?void 0:a.available_time_start)||"09:00",s=(a==null?void 0:a.available_time_end)||"17:00",c=(a==null?void 0:a.appointment_duration_minutes)||30,r=K(i,s,c),{data:u}=yield m.from("appointment_slots").select("start_time").eq("doctor_id",o).eq("date",t).eq("is_available",!1),E=new Set((u==null?void 0:u.map(g=>g.start_time))||[]);e.innerHTML=r.map(g=>{const y=E.has(g);return`
        <button
          type="button"
          class="time-btn"
          data-time="${g}"
          ${y?"disabled":""}
          onclick="selectTime('${g}')"
        >
          ${g}
        </button>
      `}).join("")}catch(a){console.error("Error loading time slots:",a)}})}function K(t,e,n){const o=[];let[a,i]=t.split(":").map(Number);const[s,c]=e.split(":").map(Number);for(;a<s||a===s&&i<c;){const r=`${String(a).padStart(2,"0")}:${String(i).padStart(2,"0")}`;o.push(r),i+=n,i>=60&&(a+=Math.floor(i/60),i=i%60)}return o}window.selectTime=t=>{document.querySelectorAll(".time-btn").forEach(n=>{n.classList.remove("selected"),n.getAttribute("data-time")===t&&n.classList.add("selected")});const e=document.getElementById("selected-time");e&&(e.value=t)};function W(){return d(this,null,function*(){const t=document.getElementById("selected-date");t.value&&(yield k(t.value))})}function ee(t){return d(this,null,function*(){try{const{data:e}=yield m.from("users").select("user_id").eq("line_user_id",t).maybeSingle();if(e){const{data:n}=yield m.from("patients").select("*").eq("user_id",e.user_id).maybeSingle();return n}return null}catch(e){return console.error("Error checking registration:",e),null}})}function te(t){return d(this,null,function*(){if(t.preventDefault(),!l){p("ไม่พบข้อมูลผู้ใช้","error");return}const e=document.getElementById("reg-phone"),n=document.getElementById("reg-id-card"),o=document.getElementById("reg-name"),a=document.getElementById("reg-dob"),i=document.getElementById("reg-chronic"),s=document.getElementById("reg-allergies"),c=document.querySelector('input[name="reg-gender"]:checked');if(!e.value||!n.value||!o.value){p("กรุณากรอกข้อมูลให้ครบถ้วน","warning");return}const r=/^0[0-9]{8,9}$/,u=e.value.replace(/-/g,"");if(!r.test(u)){p("กรุณากรอกเบอร์โทรศัพท์ให้ถูกต้อง","warning");return}const E=/^[0-9]{13}$/,g=n.value.replace(/-/g,"");if(!E.test(g)){p("กรุณากรอกเลขบัตรประชาชน 13 หลัก","warning");return}try{const{data:y}=yield m.from("patients").select("patient_id").eq("id_card_number",g).maybeSingle();if(y){p("เลขบัตรประชาชนนี้ได้ถูกลงทะเบียนแล้ว","error");return}let $;const{data:x}=yield m.from("users").select("user_id").eq("line_user_id",l.userId).maybeSingle();if(x)$=x.user_id;else{const{data:H,error:B}=yield m.from("users").insert({line_user_id:l.userId,display_name:l.displayName,picture_url:l.pictureUrl,phone:u,role:"patient"}).select("user_id").single();B?console.warn("Could not create user record, proceeding with patient only:",B):$=H.user_id}const{data:se,error:L}=yield m.from("patients").insert({user_id:$,clinic_id:"00000000-0000-0000-0000-000000000001",phone:u,id_card_number:g,name:o.value.trim(),date_of_birth:a.value||null,gender:(c==null?void 0:c.value)||null,chronic_diseases:(i==null?void 0:i.value.trim())||null,allergies:(s==null?void 0:s.value.trim())||null,first_visit_date:new Date().toISOString().split("T")[0]}).select().single();if(L)throw console.error("Patient insert error:",L),L;p("ลงทะเบียนสำเร็จ","success"),document.getElementById("registration-form").reset(),f("home"),yield S()}catch(y){console.error("Registration error:",y),p("ไม่สามารถลงทะเบียนได้ กรุณาลองใหม่","error")}})}window.cancelRegistration=function(){confirm("คุณต้องการยกเลิกการลงทะเบียนใช่หรือไม่?")&&(v.isInClient()?v.closeWindow():f("home"))};function ne(t){return d(this,null,function*(){t.preventDefault();const e=document.getElementById("doctor-select"),n=document.getElementById("selected-date"),o=document.getElementById("selected-time"),a=document.getElementById("symptoms");if(!e.value||!n.value||!o.value){p("กรุณากรอกข้อมูลให้ครบถ้วน","warning");return}try{const{data:i,error:s}=yield m.from("appointments").insert({clinic_id:"00000000-0000-0000-0000-000000000001",patient_id:null,doctor_id:e.value,appointment_date:n.value,appointment_time:o,symptoms:a.value,status:"pending"}).select().single();if(s)throw s;p("จองนัดหมายสำเร็จ","success"),document.getElementById("booking-form").reset(),f("home")}catch(i){console.error("Booking error:",i),p("ไม่สามารถจองนัดหมายได้","error")}})}function I(t){const e=new Date(t),n={year:"numeric",month:"short",day:"numeric"};return e.toLocaleDateString("th-TH",n)}function ae(t){const[e,n]=t.split(":");return`${e}:${n}`}function ie(t){const e=new Date(t),n={year:"numeric",month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"};return e.toLocaleDateString("th-TH",n)}document.addEventListener("DOMContentLoaded",()=>{U();const t=document.getElementById("booking-form");t&&t.addEventListener("submit",ne);const e=document.getElementById("registration-form");e&&e.addEventListener("submit",te)});window.navigateTo=f;window.navigateBack=F});export default oe();
//# sourceMappingURL=index-BDdUc9V6.js.map
