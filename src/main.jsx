import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { Analytics } from '@vercel/analytics/react';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { App as CapacitorApp } from '@capacitor/app';
import {
  Camera as CapacitorCamera,
  CameraResultType,
  CameraSource,
} from '@capacitor/camera';
import {
  Upload,
  Camera as CameraIcon,
  Mail,
  ShieldCheck,
  Sparkles,
  CalendarDays,
  FileText,
  CheckCircle2,
  Plus,
  Trash2,
  Pencil,
} from 'lucide-react';
import './styles.css';
import { supabase } from './supabase';

const API_BASE_URL = Capacitor.isNativePlatform()
  ? 'https://scadenzefacili.vercel.app'
  : '';

const initialDeadlines = [];

function formatDate(date) {
  if (!date) return 'Data non trovata';

  const parsedDate = new Date(date);

  if (Number.isNaN(parsedDate.getTime())) {
    return 'Data non valida';
  }

  return new Intl.DateTimeFormat('it-IT', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(parsedDate);
}

function formatAmount(amount) {
  if (amount === null || amount === undefined || Number.isNaN(amount)) {
    return '—';
  }

  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount);
}

function getCategoryClass(category) {
  switch (category) {
    case 'Casa':
      return 'category casa';
    case 'Auto':
      return 'category auto';
    case 'Documenti':
      return 'category documenti';
    default:
      return 'category altro';
  }
}

function getDeadlineStatus(date) {
  const today = new Date();
  const due = new Date(date);

  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);

  const diffDays = Math.ceil(
    (due - today) / (1000 * 60 * 60 * 24)
  );

  if (diffDays < 0) {
    return 'expired';
  }

  if (diffDays <= 7) {
    return 'urgent';
  }

  if (diffDays <= 30) {
    return 'warning';
  }

  return 'normal';
}

function getDeadlineStatusLabel(date) {
  const status = getDeadlineStatus(date);

  if (status === 'expired') return 'Scaduta';
  if (status === 'urgent') return 'Urgente';
  if (status === 'warning') return 'In arrivo';

  return 'Ok';
}

function getStatusPriority(date) {
  const status = getDeadlineStatus(date);

  if (status === 'expired') return 0;
  if (status === 'urgent') return 1;
  if (status === 'warning') return 2;

  return 3;
}

function getDaysUntilLabel(date) {
  if (!date) return 'Data non trovata';

  const today = new Date();
  const due = new Date(date);

  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);

  const diffDays = Math.ceil(
    (due - today) / (1000 * 60 * 60 * 24)
  );

  if (diffDays < 0) {
    return `Scaduta da ${Math.abs(diffDays)} giorni`;
  }

  if (diffDays === 0) {
    return 'Scade oggi';
  }

  if (diffDays === 1) {
    return 'Scade domani';
  }

  return `Scade tra ${diffDays} giorni`;
}

function isWithinNextDays(date, days) {
  if (!date) return false;

  const today = new Date();
  const due = new Date(date);

  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);

  const limit = new Date(today);
  limit.setDate(today.getDate() + days);

  return due >= today && due <= limit;
}

function HomePage() {
  const isNativeApp = Capacitor.isNativePlatform();
  const [activeTab, setActiveTab] = useState('add');

  useEffect(() => {
  document.title =
    'ScadenzeFacili - Ricorda bollette, bollo, assicurazioni e documenti';
}, []);
  const [deadlines, setDeadlines] = useState(initialDeadlines);
  const [showExtraction, setShowExtraction] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState('');
  const [showEmailPaste, setShowEmailPaste] = useState(false);
  const [emailText, setEmailText] = useState('');
  const [manualTitle, setManualTitle] = useState('');
  const [showManualForm, setShowManualForm] = useState(false);
  const [manualDate, setManualDate] = useState('');
  const [manualAmount, setManualAmount] = useState('');
  const [manualNotes, setManualNotes] = useState('');
  const [manualProvider, setManualProvider] = useState('');
  const [manualCategory, setManualCategory] = useState('');
  const [editingDeadline, setEditingDeadline] = useState(null);
  const [deadlineToDelete, setDeadlineToDelete] = useState(null);
  const [session, setSession] = useState(null);
  const [authEmail, setAuthEmail] = useState('');
  const [showLogin, setShowLogin] = useState(false);
  const [toast, setToast] = useState(null);
  const [isSavingManual, setIsSavingManual] = useState(false);
  const [isSavingExtracted, setIsSavingExtracted] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [analysisSteps, setAnalysisSteps] = useState([]);
  const fileInputRef = useRef(null);
  const editSectionRef = useRef(null);
  const emailPasteRef = useRef(null);
  const tabbarRef = useRef(null);
  const isTabbarDraggingRef = useRef(false);

  const [extracted, setExtracted] = useState({
  title: '',
  provider: '',
  category: '',
  dueDate: '',
  amount: null,
  notes: '',
  insight: '',
});

  useEffect(() => {
    async function loadDeadlines(userId) {
      if (!userId) {
        setDeadlines([]);
        return;
      }

      const { data, error } = await supabase
        .from('deadlines')
        .select('*')
        .eq('user_id', userId)
        .order('due_date', { ascending: true });

      if (error) {
        console.error('Errore caricamento Supabase:', error);
        return;
      }

      const dbDeadlines = data.map((item) => ({
  id: `db-${item.id}`,
  title: item.title,
  provider: item.provider,
  category: item.category,
  dueDate: item.due_date,
  amount: item.amount === null ? null : Number(item.amount),
  notes: item.notes,
  reminderSentAt: item.reminder_sent_at,
}));

      setDeadlines(dbDeadlines);
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      loadDeadlines(session?.user?.id);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      loadDeadlines(session?.user?.id);
    });

        let appUrlOpenListener;

    if (Capacitor.isNativePlatform()) {
      CapacitorApp.addListener('appUrlOpen', async ({ url }) => {
        try {
          const parsedUrl = new URL(url);

          const code = parsedUrl.searchParams.get('code');

          if (code) {
            const { error } = await supabase.auth.exchangeCodeForSession(code);

            if (error) {
              console.error('Errore login app:', error);
              showToast('Errore durante il login.', 'error');
              return;
            }

            setActiveTab('add');
            setShowLogin(false);
            showToast('Accesso effettuato.');
            return;
          }

          const hash = parsedUrl.hash.replace('#', '');
          const params = new URLSearchParams(hash);

          const accessToken = params.get('access_token');
          const refreshToken = params.get('refresh_token');

          if (accessToken && refreshToken) {
            const { error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });

            if (error) {
              console.error('Errore sessione app:', error);
              showToast('Errore durante il login.', 'error');
              return;
            }

            setActiveTab('add');
            setShowLogin(false);
            showToast('Accesso effettuato.');
          }
        } catch (error) {
          console.error('Errore apertura link app:', error);
        }
      }).then((listener) => {
        appUrlOpenListener = listener;
      });
    }

        return () => {
      subscription.unsubscribe();
      appUrlOpenListener?.remove();
    };
  }, []);

  const monthTotal = useMemo(
  () => deadlines.reduce((sum, item) => sum + (Number(item.amount) || 0), 0),
  [deadlines]
);

const nextSevenDays = useMemo(
  () =>
    deadlines.filter((item) =>
      isWithinNextDays(item.dueDate, 7)
    ).length,
  [deadlines]
);

const activeReminders = useMemo(
  () =>
    deadlines.filter(
      (item) =>
        getDeadlineStatus(item.dueDate) !== 'expired' &&
        !item.reminderSentAt
    ).length,
  [deadlines]
);

  const urgentDeadlines = useMemo(
    () =>
      deadlines.filter(
        (item) => getDeadlineStatus(item.dueDate) === 'urgent'
      ),
    [deadlines]
  );

  const useTabbedLayout = isNativeApp;

const showDeadlinesSection = useTabbedLayout
  ? activeTab === 'deadlines'
  : true;

const showAddSection = useTabbedLayout
  ? activeTab === 'add'
  : true;

const showGuidesSection = useTabbedLayout
  ? activeTab === 'guides'
  : true;

const showNewsSection = useTabbedLayout
  ? activeTab === 'news'
  : true;

const mobileTabs = ['deadlines', 'add', 'guides', 'news'];

const activeTabIndex = Math.max(
  mobileTabs.indexOf(activeTab),
  0
);

function getTabFromClientX(clientX) {
  const tabbar = tabbarRef.current;

  if (!tabbar) return null;

  const rect = tabbar.getBoundingClientRect();
  const x = clientX - rect.left;
  const tabWidth = rect.width / mobileTabs.length;

  const index = Math.min(
    mobileTabs.length - 1,
    Math.max(0, Math.floor(x / tabWidth))
  );

  return mobileTabs[index];
}

function updateActiveTabFromClientX(clientX) {
  const nextTab = getTabFromClientX(clientX);

  if (nextTab) {
    setActiveTab(nextTab);
  }
}

function handleTabbarTouchStart(event) {
  isTabbarDraggingRef.current = true;

  const touch = event.touches?.[0];

  if (touch) {
    updateActiveTabFromClientX(touch.clientX);
  }
}

function handleTabbarTouchMove(event) {
  if (!isTabbarDraggingRef.current) return;

  const touch = event.touches?.[0];

  if (touch) {
    event.preventDefault();
    updateActiveTabFromClientX(touch.clientX);
  }
}

function handleTabbarTouchEnd() {
  isTabbarDraggingRef.current = false;
}

function handleTabbarMouseDown(event) {
  isTabbarDraggingRef.current = true;
  updateActiveTabFromClientX(event.clientX);
}

function handleTabbarMouseMove(event) {
  if (!isTabbarDraggingRef.current) return;

  updateActiveTabFromClientX(event.clientX);
}

function handleTabbarMouseUp() {
  isTabbarDraggingRef.current = false;

}

  function showToast(message, type = 'success') {
    setToast({ message, type });

    setTimeout(() => {
      setToast(null);
    }, 3000);
  }

function getTodayDateValue() {
  const today = new Date();
  const offset = today.getTimezoneOffset();
  const localToday = new Date(today.getTime() - offset * 60 * 1000);

  return localToday.toISOString().split('T')[0];
}

  function dataUrlToFile(dataUrl, fileName) {
  const [header, base64Data] = dataUrl.split(',');
  const mimeMatch = header.match(/:(.*?);/);
  const mimeType = mimeMatch?.[1] || 'image/jpeg';

  const binary = atob(base64Data);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }

  return new File([bytes], fileName, {
    type: mimeType,
  });
}

  function requireLoginBeforeAdd() {
  if (session) {
    return true;
  }

  setActiveTab('add');
  setShowLogin(true);
  showToast('Accedi per caricare documenti e salvare le scadenze.', 'error');

  return false;
}

  async function deadlineAlreadyExists({ title, dueDate }) {
  const cleanTitle = title.trim();

  const { data, error } = await supabase
    .from('deadlines')
    .select('id')
    .eq('user_id', session?.user?.id)
    .eq('title', cleanTitle)
    .eq('due_date', dueDate)
    .limit(1);

  if (error) {
    console.error('Errore controllo duplicati:', error);
    return false;
  }

  return data.length > 0;
}

async function analyzeEmailText() {
  if (!emailText.trim()) {
    showToast('Incolla prima il testo della mail.', 'error');
    return;
  }

  setIsAnalyzing(true);
  setShowExtraction(false);
  setAnalysisSteps(['Lettura testo avviata']);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 45000);

  try {
    setTimeout(() => {
      setAnalysisSteps((steps) => [...steps, 'Analisi del testo']);
    }, 800);

    setTimeout(() => {
      setAnalysisSteps((steps) => [
        ...steps,
        'Ricerca scadenza, importo e fornitore',
      ]);
    }, 1800);

    const response = await fetch(`${API_BASE_URL}/api/extract-deadline`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
      body: JSON.stringify({
        text: emailText,
      }),
    });

    let data;

    try {
      data = await response.json();
    } catch (error) {
      console.error('Risposta non JSON:', error);
      showToast('Errore tecnico durante la lettura del testo.', 'error');
      return;
    }

    setAnalysisSteps((steps) => [...steps, 'Risposta ricevuta']);

    if (!response.ok) {
      console.error('Errore API extract-deadline:', data);
      showToast(
        data?.error || 'Errore durante l’analisi del testo.',
        'error'
      );
      return;
    }

    setExtracted({
      title: data.result?.title || 'Scadenza',
      provider: data.result?.provider || 'Fornitore non trovato',
      category: data.result?.category || 'Altro',
      dueDate: data.result?.dueDate || '',
      amount: data.result?.amount ?? null,
      notes: '',
      insight: 'Dati estratti automaticamente dal testo incollato.',
    });

    setAnalysisSteps((steps) => [...steps, 'Dati pronti da controllare']);
    setShowExtraction(true);
  } catch (error) {
    console.error('Errore analisi testo:', error);

    if (error.name === 'AbortError') {
      showToast('Analisi troppo lenta. Riprova tra poco.', 'error');
    } else {
      showToast('Errore durante l’analisi. Controlla la connessione.', 'error');
    }
  } finally {
    clearTimeout(timeoutId);
    setIsAnalyzing(false);
  }
}

async function takePhotoAndAnalyze() {
  if (!requireLoginBeforeAdd()) return;

  try {
    const photo = await CapacitorCamera.getPhoto({
      quality: 70,
      width: 1400,
      resultType: CameraResultType.DataUrl,
      source: CameraSource.Camera,
      promptLabelHeader: 'Scatta una foto',
      promptLabelPhoto: 'Scatta foto',
      promptLabelPicture: 'Usa foto',
    });

    if (!photo.dataUrl) {
      showToast('Foto non disponibile.', 'error');
      return;
    }

    const file = dataUrlToFile(
      photo.dataUrl,
      `foto-scadenza-${Date.now()}.jpg`
    );

    await analyzePdfFile(file);
  } catch (error) {
    console.error('Errore fotocamera:', error);

    if (error?.message?.toLowerCase().includes('cancel')) {
      return;
    }

    showToast('Errore durante lo scatto della foto.', 'error');
  }
}

  async function analyzePdfFile(file) {
  if (!file) return;

  function arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    const chunkSize = 32768;
    let binary = '';

    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, i + chunkSize);
      binary += String.fromCharCode(...chunk);
    }

    return btoa(binary);
  }

  function readFileAsDataUrl(fileToRead) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('Impossibile leggere la foto'));

      reader.readAsDataURL(fileToRead);
    });
  }

  function loadImage(dataUrl) {
    return new Promise((resolve, reject) => {
      const image = new Image();

      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('Impossibile caricare la foto'));

      image.src = dataUrl;
    });
  }

  function canvasToBlob(canvas) {
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Impossibile comprimere la foto'));
            return;
          }

          resolve(blob);
        },
        'image/jpeg',
        0.72
      );
    });
  }

  async function prepareImageForUpload(imageFile) {
    const dataUrl = await readFileAsDataUrl(imageFile);
    const image = await loadImage(dataUrl);

    const maxSide = 1400;
    const longestSide = Math.max(image.width, image.height);
    const scale = longestSide > maxSide ? maxSide / longestSide : 1;

    const width = Math.round(image.width * scale);
    const height = Math.round(image.height * scale);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext('2d');

    if (!context) {
      throw new Error('Canvas non disponibile');
    }

    context.drawImage(image, 0, 0, width, height);

    const blob = await canvasToBlob(canvas);

    const safeName = imageFile.name
      ? imageFile.name.replace(/\.[^/.]+$/, '.jpg')
      : 'foto-scadenza.jpg';

    return new File([blob], safeName, {
      type: 'image/jpeg',
    });
  }

  const isPdf =
    file.type === 'application/pdf' ||
    file.name?.toLowerCase().endsWith('.pdf');

  const isImage =
    file.type?.startsWith('image/') ||
    /\.(jpg|jpeg|png|heic|heif|webp)$/i.test(file.name || '');

  if (!isPdf && !isImage) {
    showToast('Formato non supportato. Carica un PDF o una foto.', 'error');
    return;
  }

  console.log('Documento selezionato:', file.name, file.type, file.size);

  setUploadedFileName(file.name || 'Documento');
  setIsAnalyzing(true);
  setShowExtraction(false);
  setAnalysisSteps(['Caricamento documento avviato']);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 45000);

  try {
    let fileToSend = file;

    if (isImage) {
      setAnalysisSteps((steps) => [...steps, 'Ottimizzazione foto']);

      fileToSend = await prepareImageForUpload(file);

      console.log(
        'Foto ottimizzata:',
        fileToSend.name,
        fileToSend.type,
        fileToSend.size
      );
    }

    if (fileToSend.size > 4 * 1024 * 1024) {
      showToast(
        'Documento troppo pesante. Prova con una foto più leggera o un PDF.',
        'error'
      );
      return;
    }

    setAnalysisSteps((steps) => [...steps, 'Preparazione documento']);

    const fileBuffer = await fileToSend.arrayBuffer();
    const fileBase64 = arrayBufferToBase64(fileBuffer);

    console.log('Documento convertito in base64:', fileBase64.length);

    setAnalysisSteps((steps) => [...steps, 'Invio documento al server']);

    const response = await fetch(`${API_BASE_URL}/api/parse-pdf`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
      body: JSON.stringify({
        fileName: fileToSend.name || 'documento',
        mimeType: fileToSend.type || 'application/octet-stream',
        fileBase64,
      }),
    });

    console.log('Risposta parse-pdf status:', response.status);

    const raw = await response.text();

    let data;

    try {
      data = JSON.parse(raw);
    } catch (error) {
      console.error('Risposta non JSON documento:', raw);
      showToast('Errore tecnico durante la lettura del documento.', 'error');
      return;
    }

    console.log('DOCUMENTO DEBUG:', data.result?.debugText);

    if (!response.ok) {
      console.error('Errore API parse-pdf:', data);
      showToast(
        data?.error || 'Errore durante la lettura del documento.',
        'error'
      );
      return;
    }

    setExtracted({
      title: data.result?.title || 'Scadenza',
      provider: data.result?.provider || 'Fornitore non trovato',
      category: data.result?.category || 'Altro',
      dueDate: data.result?.dueDate || '',
      amount: data.result?.amount ?? null,
      notes: '',
      insight: isImage
        ? 'Dati estratti automaticamente dalla foto.'
        : 'Dati estratti automaticamente dal PDF.',
    });

    setAnalysisSteps((steps) => [...steps, 'Dati estratti dal documento']);
    setShowExtraction(true);
  } catch (error) {
    console.error('Errore analisi documento:', {
      name: error?.name,
      message: error?.message,
      stack: error?.stack,
    });

    if (error.name === 'AbortError') {
      showToast(
        'Lettura troppo lenta. Riprova con un file più leggero.',
        'error'
      );
    } else {
      showToast(
        'Errore durante la lettura del documento. Prova con una foto più chiara o un PDF.',
        'error'
      );
    }
  } finally {
    clearTimeout(timeoutId);
    setIsAnalyzing(false);
  }
}

  async function saveExtracted() {
    if (!session) {
      showToast('Accedi per salvare le tue scadenze.', 'error');
      setShowLogin(true);
      return;
    }

    setIsSavingExtracted(true);

    const { insight, dueDate, ...rest } = extracted;

    const deadline = {
      title: rest.title.trim(),
      provider: rest.provider,
      category: rest.category,
      due_date: dueDate,
      amount: rest.amount,
      notes: rest.notes?.trim() || null,
      user_id: session?.user?.id,
      user_email: session?.user?.email,
    };

    const alreadyExists = await deadlineAlreadyExists({
  title: deadline.title,
  dueDate: deadline.due_date,
});

if (alreadyExists) {
  showToast('Questa scadenza è già stata salvata.', 'error');
  setIsSavingExtracted(false);
  return;
}

    const { data: existingDeadline, error: existingError } = await supabase
  .from('deadlines')
  .select('id')
  .eq('user_id', session?.user?.id)
  .eq('title', deadline.title)
  .eq('due_date', deadline.due_date)
  .maybeSingle();

if (existingError) {
  console.error('Errore controllo duplicati:', existingError);
}

if (existingDeadline) {
  showToast('Questa scadenza è già stata salvata.', 'error');
  setIsSavingExtracted(false);
  return;
}


    const { data, error } = await supabase
      .from('deadlines')
      .insert([deadline])
      .select();

    if (error) {
      console.error('Errore salvataggio Supabase:', error);
      showToast('Errore nel salvataggio.', 'error');
      setIsSavingExtracted(false);
      return;
    }

    const saved = data[0];

    setDeadlines([
      {
        id: `db-${saved.id}`,
        title: saved.title,
        provider: saved.provider,
        category: saved.category,
        dueDate: saved.due_date,
        amount: saved.amount === null ? null : Number(saved.amount),
        notes: saved.notes,
      },
      ...deadlines,
    ]);

    showToast('Scadenza salvata.');
setIsSavingExtracted(false);
setShowExtraction(false);
setShowEmailPaste(false);
setEmailText('');
setActiveTab('deadlines');
  }

  async function saveManual() {
    if (!session) {
      showToast('Accedi per salvare le tue scadenze.', 'error');
      setShowLogin(true);
      return;
    }

    if (!manualTitle.trim()) {
  showToast('Inserisci un titolo per la scadenza.', 'error');
  return;
}

if (!manualDate) {
  showToast('Inserisci la data di scadenza.', 'error');
  return;
}

if (!manualCategory) {
  showToast('Scegli una categoria.', 'error');
  return;
}

    setIsSavingManual(true);

    const deadline = {
      title: manualTitle.trim(),
      provider: manualProvider.trim() || 'Non indicato',
      category: manualCategory,
      due_date: manualDate,
      amount: manualAmount ? Number(manualAmount) : null,
      notes: manualNotes.trim() || null,
      user_id: session?.user?.id,
      user_email: session?.user?.email,
    };

    const alreadyExists = await deadlineAlreadyExists({
  title: deadline.title,
  dueDate: deadline.due_date,
});

if (alreadyExists) {
  showToast('Questa scadenza è già stata salvata.', 'error');
  setIsSavingManual(false);
  return;
}

    const { data: existingDeadline, error: existingError } = await supabase
  .from('deadlines')
  .select('id')
  .eq('user_id', session?.user?.id)
  .eq('title', deadline.title)
  .eq('due_date', deadline.due_date)
  .maybeSingle();

if (existingError) {
  console.error('Errore controllo duplicati:', existingError);
}

if (existingDeadline) {
  showToast('Questa scadenza è già stata salvata.', 'error');
  setIsSavingManual(false);
  return;
}

    const { data, error } = await supabase
      .from('deadlines')
      .insert([deadline])
      .select();

    if (error) {
      console.error('Errore salvataggio manuale:', error);
      showToast('Errore durante il salvataggio.', 'error');
      setIsSavingManual(false);
      return;
    }

    const saved = data[0];

    setDeadlines([
      {
        id: `db-${saved.id}`,
        title: saved.title,
        provider: saved.provider,
        category: saved.category,
        dueDate: saved.due_date,
        amount: saved.amount === null ? null : Number(saved.amount),
        notes: saved.notes,
      },
      ...deadlines,
    ]);

    showToast('Scadenza aggiunta.');
    setIsSavingManual(false);
    
      setManualTitle('');
      setManualProvider('');
      setManualCategory('');
      setManualDate('');
      setManualAmount('');
      setManualNotes('');
      setShowManualForm(false);
      setActiveTab('deadlines');
  }

  async function deleteDeadline(id) {
    const dbId = String(id).replace('db-', '');

    const { error } = await supabase
      .from('deadlines')
      .delete()
      .eq('id', dbId);

    if (error) {
      console.error('Errore eliminazione Supabase:', error);
      showToast('Errore durante eliminazione.', 'error');
      return;
    }

    setDeadlines(deadlines.filter((item) => item.id !== id));
    showToast('Scadenza eliminata.');
  }

  async function updateDeadline() {
    if (!editingDeadline) return;

    const dbId = String(editingDeadline.id).replace('db-', '');

    const { error } = await supabase
      .from('deadlines')
      .update({
        title: editingDeadline.title,
        provider: editingDeadline.provider,
        category: editingDeadline.category,
        due_date: editingDeadline.dueDate,
        amount:
        editingDeadline.amount === ''
          ? null
          : Number(editingDeadline.amount),
          notes: editingDeadline.notes?.trim() || null,
              })
      .eq('id', dbId);

    if (error) {
      console.error('Errore modifica Supabase:', error);
      showToast('Errore durante la modifica.', 'error');

      return;
    }

    setDeadlines(
      deadlines.map((item) =>
        item.id === editingDeadline.id
          ? {
              ...editingDeadline,
              amount:
                editingDeadline.amount === ''
                  ? null
                  : Number(editingDeadline.amount),
            }
          : item
      )
    );

    setEditingDeadline(null);
    setActiveTab('deadlines');
    showToast('Scadenza modificata.');
  }

  function startEditingDeadline(item) {
  setEditingDeadline(item);

  setTimeout(() => {
    editSectionRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
  }, 50);
}

  async function signIn() {
    if (!authEmail) return;

    setIsSigningIn(true);

    const { error } = await supabase.auth.signInWithOtp({
      email: authEmail,
      options: {
  emailRedirectTo: Capacitor.isNativePlatform()
    ? 'scadenzefacili://login'
    : window.location.origin,
},
    });

    if (error) {
      console.error(error);

      if (error.message.includes('rate limit')) {
        showToast(
          'Hai richiesto troppi link di accesso. Riprova tra circa 1 ora.',
          'error'
        );
      } else {
        showToast(error.message, 'error');
      }

      setIsSigningIn(false);
      return;
    }

    showToast('Controlla la tua email per il link di accesso.');
    setIsSigningIn(false);
    setShowLogin(false);
  }

  async function signOut() {
  if (editingDeadline) {
    const confirmLogout = confirm(
      'Hai una modifica in corso. Vuoi uscire comunque?'
    );

    if (!confirmLogout) return;
  }

  await supabase.auth.signOut();
  setEditingDeadline(null);
  showToast('Logout effettuato.');
}

  return (
    <main className={`page ${isNativeApp ? 'native-app' : ''}`}>
      {toast && (
        <div className={`toast ${toast.type}`}>
          {toast.message}
        </div>
      )}

      <div className="shell">
        <header className="header">
          <div>
            <div className="brand-row">
              <h1>ScadenzeFacili</h1>
              <span className="beta-badge">Beta privata</span>
            </div>

            <p>
  {session
    ? 'Controlla le prossime scadenze e aggiungine di nuove.'
    : Capacitor.isNativePlatform()
      ? 'Ricorda bollette, auto, documenti e pagamenti.'
      : 'Carica una bolletta, un PDF o una mail: ScadenzeFacili trova la scadenza e ti ricorda quando pagarla.'}
</p>
          </div>

          <div className="header-actions">
            {!session ? (
  !isNativeApp && (
    <button className="secondary" onClick={() => setShowLogin(true)}>
      Accedi
    </button>
  )
) : (
  <div className="user-box">
                <span>{session.user.email}</span>

                <button className="secondary" onClick={signOut}>
                  Logout
                </button>
              </div>
            )}
          </div>
        </header>

{!session && showDeadlinesSection && (
  <section className="panel login-reminder-panel">
    <div>
      <h2>Accedi per vedere le tue scadenze</h2>

      <p>
        Salva bollette, documenti, assicurazioni e promemoria in un unico posto.
      </p>
    </div>

    <button className="primary" onClick={() => setShowLogin(true)}>
      Accedi
    </button>
  </section>
)}

        {session && showDeadlinesSection && (
  <>
        <section className="panel urgent-panel">
  <h2>
    {urgentDeadlines.length > 0
      ? '⚠️ Da fare subito'
      : '✅ Nessuna scadenza urgente'}
  </h2>

  {urgentDeadlines.length > 0 ? (
    urgentDeadlines.map((item) => (
      <div key={item.id} className="urgent-item">
        <div>
          <strong>{item.title}</strong>
          <span>{getDaysUntilLabel(item.dueDate)}</span>
        </div>

        <div>
          <strong>{formatAmount(item.amount)}</strong>
          <span>{formatDate(item.dueDate)}</span>
        </div>
      </div>
    ))
  ) : (
    <p className="empty-urgent-message">
      Le prossime scadenze sono sotto controllo.
    </p>
  )}
</section>

<section className="stats">
          <Stat
            icon={<CalendarDays size={20} />}
            label="Prossimi 7 giorni"
            value={nextSevenDays}
            hint="scadenze da controllare"
          />

          <Stat
            icon={<FileText size={20} />}
            label="Totale da pagare"
            value={formatAmount(monthTotal)}
            hint="importi conosciuti"
          />

          <Stat
  icon={<CheckCircle2 size={20} />}
  label="Reminder attivi"
  value={activeReminders}
  hint="email automatiche"
/>
        </section>

        <section className="panel deadlines-panel">
          <h2>Tutte le scadenze</h2>

          <div className="deadline-list">
            {deadlines.length === 0 ? (
              <div className="empty-state enhanced-empty">
  <h3>Nessuna scadenza salvata</h3>

  <p>
    Quando aggiungi una scadenza, la vedrai qui con data, importo e promemoria.
  </p>
</div>
            ) : (
              deadlines
                .slice()
                .sort((a, b) => {
  const priorityA = getStatusPriority(a.dueDate);
  const priorityB = getStatusPriority(b.dueDate);

  if (priorityA !== priorityB) {
    return priorityA - priorityB;
  }

  return new Date(a.dueDate) - new Date(b.dueDate);
})
                .map((item) => (
                  <article
                    key={item.id}
                    className={`deadline-row ${getDeadlineStatus(
                      item.dueDate
                    )}`}
                  >
                    <div>
                      <h3>{item.title}</h3>

                      <p>
                        {item.provider} ·{' '}
                        <span className={getCategoryClass(item.category)}>
                          {item.category}
                        </span>{' '}
                        · {formatDate(item.dueDate)}
                        <br />
                        <span className="days-label">
                          {getDaysUntilLabel(item.dueDate)}
                        </span>
                      </p>

                    {item.notes && (
                      <p className="deadline-notes">    
                        {item.notes}
                      </p>
                     )}

                    </div>

                    <div className="deadline-actions">
                      <span
                        className={`status-pill ${getDeadlineStatus(
                          item.dueDate
                        )}`}
                      >
                        {getDeadlineStatusLabel(item.dueDate)}
                      </span>

                      <strong>{formatAmount(item.amount)}</strong>


                      <span
  className={`reminder-pill ${
    item.reminderSentAt ? 'sent' : getDeadlineStatus(item.dueDate) === 'expired' ? 'expired' : ''
  }`}
>
  {item.reminderSentAt
    ? 'Reminder inviato'
    : getDeadlineStatus(item.dueDate) === 'expired'
      ? 'Scadenza passata'
      : 'Email 7 giorni prima'}
</span>

                      <button
                        className="icon-button"
                        onClick={() => {
                          setActiveTab('deadlines');
                          startEditingDeadline(item);
                        }}
                        aria-label="Modifica scadenza"
                      >
                        <Pencil size={16} />
                      </button>

                      <button
                        className="icon-button"
                        onClick={() => {
                          setActiveTab('deadlines');
                          setDeadlineToDelete(item);
                        }}
                        aria-label="Elimina scadenza"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </article>
                ))
            )}
          </div>
        </section>

        {editingDeadline && (
  <section className="panel manual-panel edit-deadline-panel" ref={editSectionRef}>
    <div className="section-heading compact">
      <h2>Modifica scadenza</h2>
      <p>
        Aggiorna i dettagli della scadenza salvata.
      </p>
    </div>

    <div className="manual-form">
      <div className="manual-row">
        <input
          placeholder="Titolo"
          value={editingDeadline.title}
          onChange={(e) =>
            setEditingDeadline({
              ...editingDeadline,
              title: e.target.value,
            })
          }
        />

        <input
          placeholder="Fornitore"
          value={editingDeadline.provider}
          onChange={(e) =>
            setEditingDeadline({
              ...editingDeadline,
              provider: e.target.value,
            })
          }
        />

        <select
          value={editingDeadline?.category || ''}
          onChange={(e) =>
            setEditingDeadline({
              ...editingDeadline,
              category: e.target.value,
            })
          }
        >
          <option value="">Categoria</option>
          <option value="Casa">Casa</option>
          <option value="Auto">Auto</option>
          <option value="Documenti">Documenti</option>
          <option value="Altro">Altro</option>
        </select>

        <label className="manual-date-field">
  <span>Data di scadenza</span>

  <input
    type="date"
    value={editingDeadline.dueDate}
    onChange={(e) =>
      setEditingDeadline({
        ...editingDeadline,
        dueDate: e.target.value,
      })
    }
  />
</label>

        <input
          type="number"
          placeholder="Importo"
          value={editingDeadline.amount ?? ''}
          onChange={(e) =>
            setEditingDeadline({
              ...editingDeadline,
              amount: e.target.value,
            })
          }
        />
      </div>

      <div className="manual-row notes-row">
        <textarea
          placeholder="Note"
          value={editingDeadline?.notes || ''}
          onChange={(e) =>
            setEditingDeadline({
              ...editingDeadline,
              notes: e.target.value,
            })
          }
        />

        <button className="primary save-manual-button" onClick={updateDeadline}>
          Salva modifiche
        </button>
      </div>

      <button
        className="ghost manual-close-button"
        onClick={() => setEditingDeadline(null)}
      >
        Annulla modifica
      </button>
    </div>
  </section>
)}

      {deadlineToDelete && (
  <div className="modal-backdrop">
    <div className="confirm-modal">
      <div className="confirm-icon">
        <Trash2 size={22} />
      </div>

      <h2>Eliminare questa scadenza?</h2>

      <p>
        “{deadlineToDelete.title}” verrà rimossa definitivamente dalla tua lista.
      </p>

      <div className="confirm-actions">
        <button
          className="secondary"
          onClick={() => setDeadlineToDelete(null)}
        >
          Annulla
        </button>

        <button
          className="danger-button"
          onClick={() => {
            deleteDeadline(deadlineToDelete.id);
            setDeadlineToDelete(null);
          }}
        >
          Elimina
        </button>
      </div>
    </div>
  </div>
)}

          </>
)}

        {showLogin && !session && (
          <div className="modal-backdrop">
            <div className="login-modal app-login-modal">
  <div className="login-icon">
    <ShieldCheck size={22} />
  </div>

  <h2>Accedi per salvare le scadenze</h2>

  <p>
    Ti inviamo un link sicuro via email. Non serve password.
  </p>

              <input
  type="email"
  placeholder="Email"
  value={authEmail}
  onChange={(e) => setAuthEmail(e.target.value)}
/>

              <div className="actions">
                <button
                  className="primary"
                  onClick={signIn}
                  disabled={isSigningIn}
                >
                  {isSigningIn ? 'Invio...' : 'Ricevi link'}
                </button>

                <button className="ghost" onClick={() => setShowLogin(false)}>
                  Annulla
                </button>
              </div>
            </div>
          </div>
        )}

        {showAddSection && (
        <>

          <section className="app-section-title">
  <h2>Aggiungi una scadenza</h2>
  <p>
    Carica un documento o incolla una mail: ti aiutiamo a trovare data, importo e fornitore.
  </p>
</section>

        <div className="trust-pill add-trust-pill">
  <ShieldCheck size={16} />
  File non salvato dopo l’estrazione
</div>
          <section className={`upload-card ${session ? 'compact-upload' : ''} ${
          isDragging ? 'dragging' : ''
        }`}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);

            const file = e.dataTransfer.files?.[0];
            analyzePdfFile(file);
          }}
        >
          <input
  ref={fileInputRef}
  type="file"
  accept=".pdf,application/pdf"
  style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0];

              if (file) {
                analyzePdfFile(file);
              }
            }}
          />

          <div className="upload-copy">
            <div className="badge">
              <Sparkles size={16} />
              {isDragging
  ? 'Rilascia il documento qui'
  : session
    ? 'Nuova scadenza'
    : 'Promemoria automatici per le tue scadenze'}
            </div>

  <p>
  {session
    ? 'Scegli un file o incolla una mail. Dopo l’analisi potrai controllare tutto prima di salvare.'
    : 'Accedi per caricare documenti e creare promemoria automatici.'}
</p>

            <div className="actions">
              <button
  className="primary"
  onClick={() => {
    if (!requireLoginBeforeAdd()) return;

    fileInputRef.current?.click();
  }}
>
  <Upload size={20} />
  Carica PDF
</button>

<button
  className="secondary"
  onClick={takePhotoAndAnalyze}
>
  <CameraIcon size={20} />
  Scatta foto
</button>

              <button
  className="secondary"
  onClick={() => {
    if (!requireLoginBeforeAdd()) return;

    setShowEmailPaste(true);

    setTimeout(() => {
      emailPasteRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }, 100);
  }}
>
  <Mail size={20} />
  Incolla testo mail
</button>
            </div>

            <small>
  PDF, foto scattata o testo mail. Nessuna scadenza viene salvata senza conferma.
</small>
          </div>

          {!session && (
          <div className="examples">
            <h3>Cosa puoi caricare?</h3>
            <div>Bolletta luce, gas o internet</div>
            <div>Assicurazione auto o casa</div>
            <div>Revisione, bollo o tagliando</div>
            <div>Documento, garanzia o abbonamento</div>
          </div>
        )}
        </section>

        {showEmailPaste && (
          <section className="panel email-paste-panel" ref={emailPasteRef}>
            <h2>Incolla testo da una mail</h2>

            <p>
              Per esempio una comunicazione di pagamento, rinnovo o scadenza.
            </p>

            <textarea
              placeholder="Incolla qui il testo della mail..."
              value={emailText}
              onChange={(e) => setEmailText(e.target.value)}
            />

            <button className="primary small" onClick={analyzeEmailText}>
              Analizza testo
            </button>
          </section>
        )}

        {isAnalyzing && (
          <section className="panel analyzing-panel">
            <div className="analyzing-spinner"></div>

            <h2>Analizzo il documento...</h2>

            <p className="file-preview">
              Documento caricato: <strong>{uploadedFileName}</strong>
            </p>

            <div className="analyzing-steps">
              {analysisSteps.map((step) => (
                <div key={step}>✓ {step}</div>
              ))}

              {analysisSteps.length < 5 && (
                <div className="pending-step">Analisi in corso...</div>
              )}
            </div>
          </section>
        )}

        {showExtraction && (
          <section className="panel extraction">
            <h2>Ho trovato questa scadenza</h2>

            <p>
              Controlla i dati prima di salvarla. Non salviamo nulla senza
              conferma.
            </p>

            <div className="extracted-grid editable-extraction">
  <label>
    <span>Titolo</span>
    <input
      value={extracted.title}
      onChange={(e) =>
        setExtracted({
          ...extracted,
          title: e.target.value,
        })
      }
    />
  </label>

  <label>
    <span>Fornitore</span>
    <input
      value={extracted.provider}
      onChange={(e) =>
        setExtracted({
          ...extracted,
          provider: e.target.value,
        })
      }
    />
  </label>

  <label>
  <span>Categoria</span>

  <select
    value={extracted.category}
    onChange={(e) =>
      setExtracted({
        ...extracted,
        category: e.target.value,
      })
    }
  >
    <option value="">Categoria</option>
    <option value="Casa">Casa</option>
    <option value="Auto">Auto</option>
    <option value="Documenti">Documenti</option>
    <option value="Altro">Altro</option>
  </select>
</label>

<label>
  <span>Scadenza</span>

  <input
    type="date"
    value={extracted.dueDate}
    onChange={(e) =>
      setExtracted({
        ...extracted,
        dueDate: e.target.value,
      })
    }
  />
</label>

  <label>
    <span>Importo</span>
    <input
      type="number"
      step="0.01"
      value={extracted.amount ?? ''}
      onChange={(e) =>
        setExtracted({
          ...extracted,
          amount: e.target.value === '' ? null : Number(e.target.value),
        })
      }
    />
  </label>

    <label>
  <span>Note</span>
  <textarea
    placeholder="Aggiungi una nota facoltativa..."
    value={extracted.notes}
    onChange={(e) =>
      setExtracted({
        ...extracted,
        notes: e.target.value,
      })
    }
  />
</label>

</div>

            <div className="smart-note">
              <strong>Nota smart:</strong> {extracted.insight}
            </div>

            <div className="actions">
              <button
                className="primary"
                onClick={saveExtracted}
                disabled={isSavingExtracted}
              >
                {isSavingExtracted ? 'Salvataggio...' : 'Conferma e salva'}
              </button>

              <button
                className="ghost"
                onClick={() => setShowExtraction(false)}
              >
                Scarta
              </button>
            </div>
          </section>
        )}
          </>
        )}

        {!session && showAddSection && (
          <>

        <section className="benefits">
          <div className="benefit-card">
            <h3>Mai più dimenticanze</h3>

            <p>
              Bollo, assicurazione, bollette e documenti sempre sotto controllo.
            </p>
          </div>

          <div className="benefit-card">
            <h3>Nessun inserimento manuale</h3>

            <p>
              Carichi un PDF o una foto e ScadenzeFacili trova automaticamente
              i dati.
            </p>
          </div>

          <div className="benefit-card">
            <h3>Privacy semplice</h3>

            <p>Puoi eliminare il documento subito dopo l’estrazione.</p>
          </div>
        </section>

        

        <section className="how-it-works">
          <div className="section-heading">
            <h2>Come funziona</h2>
            <p>
              Tre passaggi semplici per trasformare un documento in un
              promemoria.
            </p>
          </div>

          <div className="steps-grid">
            <div className="step-card">
              <span>1</span>
              <h3>Carica</h3>
              <p>PDF, foto o testo copiato da una mail.</p>
            </div>

            <div className="step-card">
              <span>2</span>
              <h3>Controlla</h3>
              <p>
                ScadenzeFacili propone data, importo e categoria
                automaticamente.
              </p>
            </div>

            <div className="step-card">
              <span>3</span>
              <h3>Ricorda</h3>
              <p>Salvi la scadenza e ricevi il reminder al momento giusto.</p>
            </div>
          </div>
        </section>
          </>
      )}

{showGuidesSection && (
  <section className="panel guides-section">
    <div className="section-heading compact">
      <h2>Guide utili</h2>
      <p>
        Consigli pratici per gestire bollette, auto, documenti e scadenze di casa.
      </p>
    </div>

    <div className="guide-card">
      <div>
        <strong>Come ricordare le scadenze delle bollette</strong>
        <p>
          Un metodo semplice per non dimenticare luce, gas, telefono e internet.
        </p>
      </div>

      <Link className="secondary" to="/guide/scadenze-bollette">
        Leggi guida
      </Link>
    </div>

    <div className="guide-card">
      <div>
        <strong>Promemoria assicurazione auto: come non dimenticare il rinnovo</strong>
        <p>
          Un metodo semplice per ricordare la scadenza della polizza auto.
        </p>
      </div>

      <Link className="secondary" to="/guide/promemoria-assicurazione-auto">
        Leggi guida
      </Link>
    </div>

    <div className="guide-card">
      <div>
        <strong>Come ricordare la scadenza della revisione auto</strong>
        <p>
          Un metodo semplice per non dimenticare revisione, controlli e appuntamenti.
        </p>
      </div>

      <Link className="secondary" to="/guide/scadenza-revisione-auto">
        Leggi guida
      </Link>
    </div>
  </section>
)}

{showNewsSection && (
  <>
    <section className="privacy-section">
      <div>
        <div className="badge">
          <ShieldCheck size={16} />
          Privacy semplice
        </div>

        <h2>I tuoi documenti restano sotto controllo.</h2>

        <p>
          Usiamo il documento solo per leggere le informazioni utili alla scadenza.
          Non salviamo il file caricato: salviamo solo i dati che confermi tu,
          come titolo, data, importo, categoria e fornitore.
        </p>
      </div>

      <div className="privacy-list">
        <div>
          <strong>File non salvato</strong>
          <span>Il documento viene usato solo per l’estrazione.</span>
        </div>

        <div>
          <strong>Conferma manuale</strong>
          <span>Nessuna scadenza viene salvata senza il tuo ok.</span>
        </div>

        <div>
          <strong>Eliminazione facile</strong>
          <span>Puoi cancellare ogni scadenza quando vuoi.</span>
        </div>
      </div>
    </section>

    <section className="roadmap">
      <div className="roadmap-header">
        <h2>Roadmap beta</h2>

        <p>Stiamo costruendo ScadenzeFacili insieme ai primi utenti.</p>
      </div>

      <div className="roadmap-grid">
        <div className="roadmap-item done">
          <span>✓</span>

          <div>
            <strong>Upload PDF e foto</strong>
            <p>Carica documenti e trova automaticamente le scadenze.</p>
          </div>
        </div>

        <div className="roadmap-item done">
          <span>✓</span>

          <div>
            <strong>Estrazione automatica</strong>
            <p>Data, importo e categoria riconosciuti automaticamente.</p>
          </div>
        </div>

        <div className="roadmap-item done">
          <span>✓</span>

          <div>
            <strong>Reminder email automatici</strong>
            <p>Ricevi una mail 7 giorni prima della scadenza.</p>
          </div>
        </div>

        <div className="roadmap-item">
          <span>🔜</span>

          <div>
            <strong>Calendario famiglia</strong>
            <p>Gestisci le scadenze di tutta la famiglia in un unico posto.</p>
          </div>
        </div>
      </div>
    </section>

    <section className="beta-section">
      <div>
        <h2>Vuoi provare la beta?</h2>

        <p>
          Stiamo cercando i primi utenti per testare ScadenzeFacili con
          scadenze reali.
        </p>
      </div>

      <a
        className="beta-button"
        href="https://tally.so/r/obkGNe"
        target="_blank"
        rel="noreferrer"
      >
        Prova la beta gratis
      </a>
    </section>
  </>
)}

            {session && showAddSection && (
  <>
       <section className="panel manual-panel">
  {!showManualForm ? (
    <div className="manual-collapsed">
      <div>
        <h2>Non hai un documento?</h2>
        <p>
          Puoi aggiungere una scadenza manualmente in pochi secondi.
        </p>
      </div>

      <button
        className="secondary"
        onClick={() => setShowManualForm(true)}
      >
        <Plus size={18} />
        Aggiungi manualmente
      </button>
    </div>
  ) : (
    <>
      <div className="section-heading compact">
        <h2>Aggiungi manualmente</h2>
        <p>
          Inserisci una scadenza anche senza caricare un documento.
        </p>
      </div>

      <div className="manual-form">
        <div className="manual-row">
          <input
            placeholder="Titolo"
            value={manualTitle}
            onChange={(e) => setManualTitle(e.target.value)}
          />

          <input
            placeholder="Fornitore"
            value={manualProvider}
            onChange={(e) => setManualProvider(e.target.value)}
          />

          <select
  value={manualCategory}
  onChange={(e) => setManualCategory(e.target.value)}
>
  <option value="">Categoria</option>
  <option value="Casa">Casa</option>
  <option value="Auto">Auto</option>
  <option value="Documenti">Documenti</option>
  <option value="Altro">Altro</option>
</select>

<label className="manual-date-field">
  <span>Data di scadenza</span>

  <input
    type="date"
    value={manualDate}
    onChange={(e) => setManualDate(e.target.value)}
  />
</label>

          <input
            type="number"
            placeholder="Importo"
            value={manualAmount}
            onChange={(e) => setManualAmount(e.target.value)}
          />
        </div>

        <div className="manual-row notes-row">
          <textarea
            placeholder="Note facoltative, es. pagamento già impostato, rinnovo automatico..."
            value={manualNotes}
            onChange={(e) => setManualNotes(e.target.value)}
          />

          <button
            className="primary save-manual-button"
            onClick={saveManual}
            disabled={isSavingManual}
          >
            <Plus size={16} />
            {isSavingManual ? 'Salvataggio...' : 'Salva scadenza'}
          </button>
        </div>

        <button
          className="ghost manual-close-button"
          onClick={() => setShowManualForm(false)}
        >
          Chiudi inserimento manuale
        </button>
      </div>
    </>
  )}
</section>
      
          </>
)}
            </div>

      {isNativeApp && (
  <nav
  ref={tabbarRef}
  className="mobile-tabbar"
  aria-label="Navigazione app"
  style={{ '--active-tab-index': activeTabIndex }}
  onTouchStart={handleTabbarTouchStart}
  onTouchMove={handleTabbarTouchMove}
  onTouchEnd={handleTabbarTouchEnd}
  onTouchCancel={handleTabbarTouchEnd}
  onMouseDown={handleTabbarMouseDown}
  onMouseMove={handleTabbarMouseMove}
  onMouseUp={handleTabbarMouseUp}
  onMouseLeave={handleTabbarMouseUp}
>
    <span className="mobile-tabbar__liquid" aria-hidden="true"></span>

    <button
      type="button"
      className={`mobile-tabbar__item ${
        activeTab === 'deadlines' ? 'is-active' : ''
      }`}
      onClick={() => setActiveTab('deadlines')}
    >
      <CalendarDays size={20} strokeWidth={2.2} />
      <span>Scadenze</span>
    </button>

    <button
      type="button"
      className={`mobile-tabbar__item ${
        activeTab === 'add' ? 'is-active' : ''
      }`}
      onClick={() => setActiveTab('add')}
    >
      <Upload size={20} strokeWidth={2.2} />
      <span>Aggiungi</span>
    </button>

    <button
      type="button"
      className={`mobile-tabbar__item ${
        activeTab === 'guides' ? 'is-active' : ''
      }`}
      onClick={() => setActiveTab('guides')}
    >
      <FileText size={20} strokeWidth={2.2} />
      <span>Guide</span>
    </button>

    <button
      type="button"
      className={`mobile-tabbar__item ${
        activeTab === 'news' ? 'is-active' : ''
      }`}
      onClick={() => setActiveTab('news')}
    >
      <Sparkles size={20} strokeWidth={2.2} />
      <span>Novità</span>
    </button>
  </nav>
)}
    </main>
  );
}

function Info({ label, value }) {
  return (
    <div className="info">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Stat({ icon, label, value, hint }) {
  return (
    <div className="stat-card">
      <div className="stat-label">
        {icon} {label}
      </div>
      <strong>{value}</strong>
      <p>{hint}</p>
    </div>
  );
}

function GuideBollettePage() {
  useEffect(() => {
  document.title =
    'Come ricordare le scadenze delle bollette | ScadenzeFacili';
}, []);
  return (
    <main className="page">
      <div className="shell">
        <header className="header">
          <div>
            <div className="brand-row">
              <h1>ScadenzeFacili</h1>
              <span className="beta-badge">Guida</span>
            </div>

            <p>Consigli pratici per ricordare le scadenze delle bollette.</p>
          </div>

          <Link className="secondary" to="/">
            Torna alla home
          </Link>
        </header>

        <section className="panel guide-page">
          <p className="badge">Guida pratica</p>

          <h2>Come ricordare le scadenze delle bollette</h2>

          <p>
            Tra luce, gas, telefono, internet e Tari è facile perdere una
            scadenza. Il problema non è solo pagare in ritardo: spesso ci si
            accorge della bolletta quando ormai è vicina alla data limite.
          </p>

          <h3>Perché le bollette si dimenticano facilmente</h3>

          <p>
            Le scadenze arrivano da canali diversi: email, PDF, area clienti,
            posta cartacea o notifiche dell’app del fornitore. Se non vengono
            raccolte in un unico posto, diventa difficile ricordarle tutte.
          </p>

          <h3>Un metodo semplice</h3>

          <p>
            Ogni volta che ricevi una bolletta, salva subito tre informazioni:
            fornitore, importo e data di scadenza. Poi imposta un promemoria
            qualche giorno prima, così hai tempo di controllare o pagare.
          </p>

          <h3>Come può aiutarti ScadenzeFacili</h3>

          <p>
            Con ScadenzeFacili puoi caricare un PDF, una foto o incollare il
            testo di una mail. L’app prova a trovare data, importo e fornitore,
            tu controlli i dati e salvi la scadenza. Poi ricevi una mail 7
            giorni prima.
          </p>

          <div className="actions">
            <Link className="primary" to="/">
              Prova ScadenzeFacili
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}

function GuideAssicurazioneAutoPage() {
  useEffect(() => {
  document.title =
    'Promemoria assicurazione auto: come non dimenticare il rinnovo | ScadenzeFacili';
}, []);
  return (
    <main className="page">
      <div className="shell">
        <header className="header">
          <div>
            <div className="brand-row">
              <h1>ScadenzeFacili</h1>
              <span className="beta-badge">Guida</span>
            </div>

            <p>Consigli pratici per ricordare il rinnovo dell’assicurazione auto.</p>
          </div>

          <Link className="secondary" to="/">
            Torna alla home
          </Link>
        </header>

        <section className="panel guide-page">
          <p className="badge">Guida pratica</p>

          <h2>Promemoria assicurazione auto: come non dimenticare il rinnovo</h2>

          <p>
            L’assicurazione auto è una delle scadenze più importanti da ricordare.
            Dimenticare il rinnovo può creare problemi, soprattutto se usi l’auto
            ogni giorno per lavoro, famiglia o spostamenti quotidiani.
          </p>

          <h3>Perché è facile dimenticarla</h3>

          <p>
            Il rinnovo arriva spesso una volta all’anno, quindi non è una scadenza
            che hai sempre sotto controllo. La comunicazione può arrivare via email,
            area clienti, app dell’assicurazione o messaggio dell’agenzia.
          </p>

          <h3>Un metodo semplice per ricordarla</h3>

          <p>
            Appena ricevi il documento o la comunicazione di rinnovo, salva subito
            tre informazioni: compagnia assicurativa, data di scadenza e importo.
            Poi imposta un promemoria almeno una settimana prima.
          </p>

          <h3>Come può aiutarti ScadenzeFacili</h3>

          <p>
            Con ScadenzeFacili puoi caricare il PDF dell’assicurazione, una foto o
            incollare il testo della mail ricevuta. L’app prova a trovare data,
            importo e fornitore. Tu controlli i dati e salvi la scadenza.
          </p>

          <p>
            Una volta salvata, ricevi un reminder email 7 giorni prima, così hai
            tempo per verificare il rinnovo, confrontare eventuali alternative o
            contattare l’agenzia.
          </p>

          <div className="actions">
            <Link className="primary" to="/">
              Prova ScadenzeFacili gratis
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}

function GuideRevisioneAutoPage() {
  useEffect(() => {
    document.title =
      'Come ricordare la scadenza della revisione auto | ScadenzeFacili';
  }, []);

  return (
    <main className="page">
      <div className="shell">
        <header className="header">
          <div>
            <div className="brand-row">
              <h1>ScadenzeFacili</h1>
              <span className="beta-badge">Guida</span>
            </div>

            <p>Consigli pratici per ricordare la scadenza della revisione auto.</p>
          </div>

          <Link className="secondary" to="/">
            Torna alla home
          </Link>
        </header>

        <section className="panel guide-page">
          <p className="badge">Guida pratica</p>

          <h2>Come ricordare la scadenza della revisione auto</h2>

          <p>
            La revisione auto è una scadenza facile da dimenticare perché non
            arriva ogni mese e spesso non è collegata a una bolletta o a un
            pagamento ricorrente.
          </p>

          <h3>Perché è facile dimenticarla</h3>

          <p>
            Molte persone si ricordano della revisione solo quando controllano
            i documenti dell’auto o quando devono prenotare un controllo. Se la
            data non viene salvata subito, rischia di perdersi.
          </p>

          <h3>Un metodo semplice</h3>

          <p>
            Dopo ogni revisione, salva subito la prossima scadenza. Puoi segnare
            anche il centro revisioni, il costo e una nota, per esempio
            “prenotare qualche giorno prima”.
          </p>

          <h3>Come può aiutarti ScadenzeFacili</h3>

          <p>
            Con ScadenzeFacili puoi aggiungere la revisione manualmente oppure
            caricare una foto o un documento. Una volta salvata, ricevi un
            reminder email 7 giorni prima.
          </p>

          <div className="actions">
            <Link className="primary" to="/">
              Prova ScadenzeFacili gratis
            </Link>
          </div>
        </section>
        </div>
    </main>
  );
}


function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
  <Route path="/" element={<HomePage />} />

  <Route
    path="/guide/scadenze-bollette"
    element={<GuideBollettePage />}
  />

  <Route
    path="/guide/promemoria-assicurazione-auto"
    element={<GuideAssicurazioneAutoPage />}
  />

    <Route
  path="/guide/scadenza-revisione-auto"
  element={<GuideRevisioneAutoPage />}
/>

</Routes>
    </BrowserRouter>
  );
}

createRoot(document.getElementById('root')).render(
  <>
    <AppRouter />
    <Analytics />
  </>
);
if (Capacitor.isNativePlatform()) {
  StatusBar.setOverlaysWebView({ overlay: false });
  StatusBar.setStyle({ style: Style.Light });
  StatusBar.setBackgroundColor({ color: '#f8fafc' });
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((error) => {
      console.error('Errore registrazione service worker:', error);
    });
  });
}