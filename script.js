import {
  Client
} from "https://esm.sh/@gradio/client";

let currentFile = null;
let audioContexts = {};

document.getElementById('cfg_agg').addEventListener('input', (e) => {
  document.getElementById('aggValue').innerText = e.target.value;
});

window.showToast = function(message, type = 'success') {
  const icons = {
    success: 'fa-check-circle',
    error: 'fa-times-circle',
    warning: 'fa-exclamation-circle'
  };
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<i class="fas ${icons[type]}"></i><span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}

window.showPage = function(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById(page).classList.add('active');
}

window.handleDragOver = function(e) {
  e.preventDefault();
  document.getElementById('uploadArea').classList.add('dragover');
}

window.handleDragLeave = function(e) {
  document.getElementById('uploadArea').classList.remove('dragover');
}

window.handleDrop = function(e) {
  e.preventDefault();
  document.getElementById('uploadArea').classList.remove('dragover');
  if (e.dataTransfer.files.length > 0) {
    currentFile = e.dataTransfer.files[0];
    showFileInfo();
  }
}

window.handleFileSelect = function(e) {
  if (e.target.files.length > 0) {
    currentFile = e.target.files[0];
    showFileInfo();
  }
}

async function drawWaveform(file) {
  const canvas = document.getElementById('waveformCanvas');
  const ctx = canvas.getContext('2d');

  canvas.width = canvas.offsetWidth;
  canvas.height = canvas.offsetHeight;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = '#6366f1';
  ctx.font = 'bold 12px Cairo';
  ctx.fillText('جاري تحليل موجة الصوت...', 15, canvas.height / 2);

  try {
    const arrayBuffer = await file.arrayBuffer();
    const actx = new(window.AudioContext || window.webkitAudioContext)();
    const audioBuffer = await actx.decodeAudioData(arrayBuffer);
    const rawData = audioBuffer.getChannelData(0);

    const samples = 100;
    const blockSize = Math.floor(rawData.length / samples);
    const filteredData = [];
    for (let i = 0; i < samples; i++) {
      let blockStart = blockSize * i;
      let sum = 0;
      for (let j = 0; j < blockSize; j++) {
        sum += Math.abs(rawData[blockStart + j]);
      }
      filteredData.push(sum / blockSize);
    }

    const multiplier = Math.pow(Math.max(...filteredData), -1);
    const normalizedData = filteredData.map(n => n * multiplier);

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const barWidth = (canvas.width / samples) - 2;

    normalizedData.forEach((val, i) => {
      const barHeight = Math.max(val * (canvas.height - 10), 4);
      const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
      gradient.addColorStop(0, '#818cf8');
      gradient.addColorStop(1, '#6366f1');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.roundRect(i * (barWidth + 2), (canvas.height - barHeight) / 2, barWidth, barHeight, 4);
      ctx.fill();
    });
  } catch (e) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillText('جاهز للمعالجة', 15, canvas.height / 2);
  }
}

function showFileInfo() {
  if (!currentFile) return;

  document.getElementById('fileName').innerText = currentFile.name.substring(0, 20) + '...';
  document.getElementById('fileSize').innerText = (currentFile.size / 1048576).toFixed(1) + ' MB';
  document.getElementById('fileInfo').classList.add('show');
  document.getElementById('settingsSection').classList.add('show');
  document.getElementById('waveformSection').classList.add('show');

  const audio = new Audio();
  audio.src = URL.createObjectURL(currentFile);
  audio.onloadedmetadata = () => {
    const minutes = Math.floor(audio.duration / 60);
    const seconds = Math.floor(audio.duration % 60);
    document.getElementById('fileDuration').innerText = `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  drawWaveform(currentFile);
}

window.togglePlay = function(audioId, button) {
  const audio = document.getElementById(audioId);
  const icon = button.querySelector('i');

  if (audio.paused) {
    audio.play();
    icon.className = 'fas fa-pause';
  } else {
    audio.pause();
    icon.className = 'fas fa-play';
  }
}

window.seekAudio = function(id, val) {
  const audio = document.getElementById(id);
  if (audio.duration) audio.currentTime = (val / 100) * audio.duration;
}

window.updateProgress = function(id, seekId, currentId) {
  const audio = document.getElementById(id);
  if (audio.duration) {
    document.getElementById(seekId).value = (audio.currentTime / audio.duration) * 100;
    document.getElementById(currentId).innerText = formatTime(audio.currentTime);
  }
}

window.setDuration = function(id, displayId) {
  document.getElementById(displayId).innerText = formatTime(document.getElementById(id).duration);
}

window.formatTime = function(sec) {
  if (!sec || isNaN(sec)) return '0:00';
  return Math.floor(sec / 60) + ':' + Math.floor(sec % 60).toString().padStart(2, '0');
}

window.downloadAudio = function(id, name) {
  const url = document.getElementById(id).src;
  if (!url) return showToast('لا يوجد ملف متاح', 'error');
  
  showToast('جاري بدء التنزيل... تابع تقدم التحميل في إشعارات جوالك', 'success');
  
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.target = '_blank';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

window.startProcessing = async function() {
  if (!currentFile) return showToast('اختر ملف صوتي أولاً', 'warning');
  
  const savedToken = localStorage.getItem('hf_token');
  if (!savedToken) {
    showToast('يرجى وضع توكن Hugging Face في صفحة الإعدادات أولاً', 'error');
    showPage('settings');
    return;
  }

  document.getElementById('processBtn').disabled = true;
  document.getElementById('progressSection').classList.add('show');
  document.getElementById('resultsSection').classList.remove('show');
  document.getElementById('progressStatus').innerText = 'جاري الاتصال ورفع الملف...';

  let p = 0;
  let simInterval = setInterval(() => {
    if (p < 30) {
      p += 1.5;
      document.getElementById('progressStatus').innerText = "جاري رفع البيانات...";
    } else if (p < 85) {
      p += 0.3;
      document.getElementById('progressStatus').innerText = "جاري العزل بالذكاء الاصطناعي...";
    }
    updateProcessing(Math.floor(p));
  }, 300);

  try {
    const client = await Client.connect("TheStinger/UVR5_UI", { hf_token: savedToken });
    const result = await client.predict("/vrarch_separator", {
      audio: currentFile,
      model: "6_HP-Karaoke-UVR.pth",
      out_format: "wav",
      window_size: parseInt(document.getElementById('cfg_window').value),
      aggression: parseInt(document.getElementById('cfg_agg').value),
      tta: document.getElementById('cfg_tta').checked,
      post_process: document.getElementById('cfg_post').checked,
      post_process_threshold: 0.1,
      high_end_process: document.getElementById('cfg_high').checked,
      batch_size: 1,
      norm_thresh: 0.1,
      amp_thresh: 0.1,
      single_stem: "(None)"
    });

    clearInterval(simInterval);
    document.getElementById('progressStatus').innerText = 'تم العزل! جاري تحميل الصوتيات للمتصفح...';
    updateProcessing(90);

    const getUrl = (i) => typeof i === 'string' ? i : (i?.url || (i?.path ? "https://thestinger-uvr5-ui.hf.space/file=" + i.path : ''));
    
    // السحب المباشر والسريع بدون تضخيم
    const fetchWithAuth = async (url) => {
      if (!url) return '';
      try {
        const res = await fetch(url, { headers: { "Authorization": `Bearer ${savedToken}` } });
        // إذا فشل الطلب، منرجع قيمة فاضية بدل الرابط عشان المتصفح ما يحمل صفحة HTML
        if (!res.ok) return ''; 
        const blob = await res.blob();
        return URL.createObjectURL(blob);
      } catch (e) {
        return '';
      }
    };

    // هون السر: طلبنا الملفات بالترتيب (واحد ورا التاني) عشان السيرفر ما يعمل بلوك للطلب التاني
    const instBlob = await fetchWithAuth(getUrl(result.data[0]));
    const vocalBlob = await fetchWithAuth(getUrl(result.data[1]));

    document.getElementById('instAudio').src = instBlob;
    document.getElementById('vocalAudio').src = vocalBlob;

    updateProcessing(100);
    document.getElementById('progressStatus').innerText = 'تمت المعالجة بنجاح!';

    saveToHistory(currentFile.name);

    setTimeout(() => {
      document.getElementById('progressSection').classList.remove('show');
      document.getElementById('resultsSection').classList.add('show');
      document.getElementById('processBtn').disabled = false;
      showToast('✨ تم الفصل بنجاح!', 'success');
    }, 1000);
  } catch (err) {
    clearInterval(simInterval);
    console.error(err);
    showToast('حدث خطأ! تأكد من صحة التوكن في الإعدادات.', 'error');
    document.getElementById('processBtn').disabled = false;
    document.getElementById('progressSection').classList.remove('show');
  }
}

function updateProcessing(percent) {
  document.getElementById('progressPercent').innerText = percent + '%';
  document.getElementById('progressFill').style.width = percent + '%';

  const steps = [{
      id: 1,
      min: 0,
      max: 25
    },
    {
      id: 2,
      min: 25,
      max: 50
    },
    {
      id: 3,
      min: 50,
      max: 75
    },
    {
      id: 4,
      min: 75,
      max: 100
    }
  ];

  steps.forEach(s => {
    const step = document.getElementById('step' + s.id);
    if (percent >= s.max) {
      step.classList.add('done');
      step.classList.remove('active');
    } else if (percent >= s.min) {
      step.classList.add('active');
      step.classList.remove('done');
    }
  });
}

window.saveToHistory = function(name) {
  let history = JSON.parse(localStorage.getItem('voiceHistory') || '[]');
  history.unshift({
    name,
    date: new Date().toLocaleString('ar-SA')
  });
  localStorage.setItem('voiceHistory', JSON.stringify(history.slice(0, 30)));
  loadHistory();
}

window.loadHistory = function() {
  const history = JSON.parse(localStorage.getItem('voiceHistory') || '[]');
  const list = document.getElementById('historyList');
  if (history.length === 0) {
    list.innerHTML = '<p style="text-align: center; color: #94a3b8; padding: 2rem;">لا توجد معالجات سابقة</p>';
    return;
  }
  list.innerHTML = history.map(h => `<div style="padding: 1rem; border: 1px solid #e2e8f0; border-radius: 8px; margin-bottom: 0.75rem;"><strong>${h.name}</strong><br><small style="color: #94a3b8;">${h.date}</small></div>`).join('');
}

window.clearHistory = function() {
  localStorage.removeItem('voiceHistory');
  loadHistory();
  showToast('تم مسح السجل بنجاح', 'success');
}

window.saveSettings = function() {
  const token = document.getElementById('hf_token_input').value;
  if (token) {
    localStorage.setItem('hf_token', token.trim());
  }
  showToast('✅ تم حفظ الإعدادات', 'success');
}

document.getElementById('hf_token_input').value = localStorage.getItem('hf_token') || '';

loadHistory();
showToast('👋 مرحباً بك في Voice Studio', 'success');