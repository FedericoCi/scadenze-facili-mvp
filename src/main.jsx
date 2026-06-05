import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Upload,
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

const initialDeadlines = [
  {
    id: 1,
    title: 'Bolletta luce',
    provider: 'Enel Energia',
    category: 'Casa',
    dueDate: '2026-06-14',
    amount: 87.4,
  },
  {
    id: 2,
    title: 'Assicurazione auto',
    provider: 'UnipolSai',
    category: 'Auto',
    dueDate: '2026-06-28',
    amount: 412,
  },
  {
    id: 3,
    title: "Carta d'identità",
    provider: 'Comune',
    category: 'Documenti',
    dueDate: '2026-07-31',
    amount: null,
  },
];

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

  const diffDays = Math.ceil((due - today) / (1000 * 60 * 60 * 24));

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

  if (status === 'urgent') return 'Urgente';
  if (status === 'warning') return 'In arrivo';

  return 'Ok';
}

function App() {
  const [deadlines, setDeadlines] = useState(initialDeadlines);
  const [showExtraction, setShowExtraction] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState('');
  const [showEmailPaste, setShowEmailPaste] = useState(false);
  const [emailText, setEmailText] = useState('');
  const [manualTitle, setManualTitle] = useState('');
  const [manualDate, setManualDate] = useState('');
  const [manualAmount, setManualAmount] = useState('');
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

  const [extracted, setExtracted] = useState({
    title: '',
    provider: '',
    category: 'Altro',
    dueDate: '',
    amount: null,
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

    return () => subscription.unsubscribe();
  }, []);

  const monthTotal = useMemo(
    () => deadlines.reduce((sum, item) => sum + (Number(item.amount) || 0), 0),
    [deadlines]
  );

  const nextSevenDays = useMemo(
    () =>
      deadlines.filter(
        (item) => new Date(item.dueDate) <= new Date('2026-06-29')
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

  function showToast(message, type = 'success') {
    setToast({ message, type });

    setTimeout(() => {
      setToast(null);
    }, 3000);
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

    setTimeout(() => {
      setAnalysisSteps((steps) => [...steps, 'Analisi del testo']);
    }, 800);

    setTimeout(() => {
      setAnalysisSteps((steps) => [
        ...steps,
        'Ricerca scadenza, importo e fornitore',
      ]);
    }, 1800);

    const response = await fetch('/api/extract-deadline', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
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
      setIsAnalyzing(false);
      return;
    }

    setAnalysisSteps((steps) => [...steps, 'Risposta ricevuta']);

    if (!response.ok) {
      console.error(data);
      showToast('Errore durante l’analisi.', 'error');
      setIsAnalyzing(false);
      return;
    }

    setExtracted({
      title: data.result.title || 'Scadenza',
      provider: data.result.provider || 'Fornitore non trovato',
      category: data.result.category || 'Altro',
      dueDate: data.result.dueDate,
      amount: data.result.amount ?? null,
      insight: 'Dati estratti automaticamente dal testo incollato.',
    });

    setIsAnalyzing(false);
    setAnalysisSteps((steps) => [...steps, 'Dati pronti da controllare']);
    setShowExtraction(true);
  }

  async function analyzePdfFile(file) {
    if (!file) return;

    setUploadedFileName(file.name);
    setIsAnalyzing(true);
    setShowExtraction(false);
    setAnalysisSteps(['Caricamento PDF avviato']);

    setTimeout(() => {
      setAnalysisSteps((steps) => [...steps, 'Lettura testo dal PDF']);
    }, 800);

    const response = await fetch('/api/parse-pdf', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/pdf',
      },
      body: file,
    });

    const raw = await response.text();

    let data;

    try {
      data = JSON.parse(raw);
      console.log('PDF DEBUG:', data.result?.debugText);
    } catch (error) {
      console.error('Risposta non JSON:', raw);
      showToast('Errore tecnico durante la lettura del PDF.', 'error');
      setIsAnalyzing(false);
      return;
    }

    if (!response.ok) {
      console.error(data);
      showToast('Errore durante la lettura del PDF.', 'error');
      setIsAnalyzing(false);
      return;
    }

    setExtracted({
      title: data.result.title || 'Scadenza',
      provider: data.result.provider || 'Fornitore non trovato',
      category: data.result.category || 'Altro',
      dueDate: data.result.dueDate,
      amount: data.result.amount ?? null,
      insight: 'Dati estratti automaticamente dal PDF.',
    });

    setAnalysisSteps((steps) => [...steps, 'Dati estratti dal PDF']);
    setIsAnalyzing(false);
    setShowExtraction(true);
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
      },
      ...deadlines,
    ]);

    showToast('Scadenza salvata.');
    setIsSavingExtracted(false);
    setShowExtraction(false);
    setShowEmailPaste(false);
    setEmailText('');
  }
console.log('EMAIL SESSION:', session?.user?.email);
  async function saveManual() {
    if (!session) {
      showToast('Accedi per salvare le tue scadenze.', 'error');
      setShowLogin(true);
      return;
    }

    if (!manualTitle || !manualDate) return;

    setIsSavingManual(true);

    const deadline = {
      title: manualTitle.trim(),
      provider: 'Inserito manualmente',
      category: 'Altro',
      due_date: manualDate,
      amount: manualAmount ? Number(manualAmount) : null,
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
      },
      ...deadlines,
    ]);

    showToast('Scadenza aggiunta.');
    setIsSavingManual(false);
    setManualTitle('');
    setManualDate('');
    setManualAmount('');
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
    showToast('Scadenza modificata.');
  }

  async function signIn() {
    if (!authEmail) return;

    setIsSigningIn(true);

    const { error } = await supabase.auth.signInWithOtp({
      email: authEmail,
      options: {
        emailRedirectTo: window.location.origin,
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

  async function sendTestEmail() {async function sendReminderEmail(deadline) {
  if (!session?.user?.email) {
    showToast('Accedi prima di inviare una mail.', 'error');
    setShowLogin(true);
    return;
  }

  const response = await fetch('/api/send-reminder', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: session.user.email,
      deadline,
    }),
  });

  if (!response.ok) {
    showToast('Errore invio email.', 'error');
    return;
  }

  showToast('Promemoria email inviato.');
}}

  return (
    <main className="page">
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

            <p>Non dimenticare più bollette, bolli e documenti.</p>
          </div>

          <div className="header-actions">
            {!session ? (
              <button className="secondary" onClick={() => setShowLogin(true)}>
                Accedi
              </button>
            ) : (
              <div className="user-box">
                <span>{session.user.email}</span>

                <button className="secondary" onClick={signOut}>
                  Logout
                </button>
              </div>
            )}

            <div className="trust-pill">
              <ShieldCheck size={16} />
              File non salvato dopo l’estrazione
            </div>
          </div>
        </header>

        {showLogin && !session && (
          <div className="modal-backdrop">
            <div className="login-modal">
              <h2>Accedi a ScadenzeFacili</h2>

              <p>Ti invieremo un link sicuro per entrare senza password.</p>

              <input
                type="email"
                placeholder="La tua email"
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

        <section
          className={`upload-card ${isDragging ? 'dragging' : ''}`}
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
            accept=".pdf,image/*"
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
                : 'Da documento a promemoria'}
            </div>

            <h2>Carica un PDF o una foto.</h2>

            <p>
              ScadenzeFacili trova data, importo e categoria automaticamente.
              Tu controlli e salvi la scadenza.
            </p>

            <div className="actions">
              <button
                className="primary"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload size={20} />
                Carica documento
              </button>

              <button
                className="secondary"
                onClick={() => setShowEmailPaste(!showEmailPaste)}
              >
                <Mail size={20} />
                Incolla testo mail
              </button>
            </div>

            <small>
              Puoi cliccare sul bottone o trascinare un file in quest’area.
            </small>
          </div>

          <div className="examples">
            <h3>Cosa puoi caricare?</h3>
            <div>Bolletta luce, gas o internet</div>
            <div>Assicurazione auto o casa</div>
            <div>Revisione, bollo o tagliando</div>
            <div>Documento, garanzia o abbonamento</div>
          </div>
        </section>

        {showEmailPaste && (
          <section className="panel">
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

            <div className="extracted-grid">
              <Info label="Titolo" value={extracted.title} />
              <Info label="Fornitore" value={extracted.provider} />
              <Info label="Categoria" value={extracted.category} />
              <Info label="Scadenza" value={formatDate(extracted.dueDate)} />
              <Info label="Importo" value={formatAmount(extracted.amount)} />
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
                className="secondary"
                onClick={() => setShowExtraction(false)}
              >
                Modifica
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

            <div className="roadmap-item">
              <span>🔜</span>

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

        <section className="stats">
          <Stat
            icon={<CalendarDays size={20} />}
            label="Prossimi 7 giorni"
            value={nextSevenDays}
            hint="scadenze da controllare"
          />

          <Stat
            icon={<FileText size={20} />}
            label="Uscite previste"
            value={formatAmount(monthTotal)}
            hint="importi conosciuti"
          />

          <Stat
            icon={<CheckCircle2 size={20} />}
            label="Reminder"
            value="Email"
            hint="push nella versione futura"
          />
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
            Entra nella beta
          </a>
        </section>

        <section className="panel">
          <h2>Aggiungi manualmente</h2>

          <div className="manual-grid">
            <input
              placeholder="Titolo"
              value={manualTitle}
              onChange={(e) => setManualTitle(e.target.value)}
            />

            <input
              type="date"
              value={manualDate}
              onChange={(e) => setManualDate(e.target.value)}
            />

            <input
              type="number"
              placeholder="Importo"
              value={manualAmount}
              onChange={(e) => setManualAmount(e.target.value)}
            />

            <button
              className="primary"
              onClick={saveManual}
              disabled={isSavingManual}
            >
              <Plus size={16} />
              {isSavingManual ? 'Salvataggio...' : 'Salva'}
            </button>
          </div>
        </section>

        {editingDeadline && (
          <section className="panel">
            <h2>Modifica scadenza</h2>

            <div className="manual-grid">
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

            <div className="actions edit-actions">
              <button className="primary" onClick={updateDeadline}>
                Salva modifiche
              </button>

              <button
                className="secondary"
                onClick={() => setEditingDeadline(null)}
              >
                Annulla
              </button>
            </div>
          </section>
        )}

        {deadlineToDelete && (
          <div className="modal-backdrop">
            <div className="login-modal">
              <h2>Eliminare la scadenza?</h2>

              <p>Questa azione non può essere annullata.</p>

              <div className="actions">
                <button
                  className="ghost"
                  onClick={() => setDeadlineToDelete(null)}
                >
                  Annulla
                </button>

                <button
                  className="primary"
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

        {urgentDeadlines.length > 0 && (
          <section className="panel">
            <h2>⚠️ Da fare subito</h2>

            {urgentDeadlines.map((item) => (
              <div key={item.id} className="urgent-item">
                <strong>{item.title}</strong>
                <div>{formatDate(item.dueDate)}</div>
              </div>
            ))}
          </section>
        )}

        <section className="panel">
          <h2>Scadenze salvate</h2>

          <div className="deadline-list">
            {deadlines.length === 0 ? (
              <div className="empty-state">
                <h3>Nessuna scadenza salvata</h3>

                <p>
                  Carica una bolletta, una revisione o aggiungi una scadenza
                  manualmente per iniziare.
                </p>
              </div>
            ) : (
              deadlines
                .slice()
                .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
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
                      </p>
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


                      <span className="reminder-pill">
                          Email 7 giorni prima
                      </span>

                      <button
                        className="secondary"
                          onClick={() => sendReminderEmail(item)}
                        >
                          Invia reminder
                             </button>

                      <button
                        className="icon-button"
                        onClick={() => setEditingDeadline(item)}
                        aria-label="Modifica scadenza"
                      >
                        <Pencil size={16} />
                      </button>

                      <button
                        className="icon-button"
                        onClick={() => setDeadlineToDelete(item)}
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
      </div>
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

createRoot(document.getElementById('root')).render(<App />);