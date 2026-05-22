import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Upload, Mail, ShieldCheck, Sparkles, CalendarDays, FileText, CheckCircle2, Plus, Trash2, Pencil } from 'lucide-react';
import './styles.css';
import { supabase } from './supabase';

const initialDeadlines = [
  { id: 1, title: 'Bolletta luce', provider: 'Enel Energia', category: 'Casa', dueDate: '2026-06-14', amount: 87.4 },
  { id: 2, title: 'Assicurazione auto', provider: 'UnipolSai', category: 'Auto', dueDate: '2026-06-28', amount: 412 },
  { id: 3, title: "Carta d'identità", provider: 'Comune', category: 'Documenti', dueDate: '2026-07-31', amount: null },
];

function formatDate(date) {
  return new Intl.DateTimeFormat('it-IT', { day: '2-digit', month: 'long', year: 'numeric' }).format(new Date(date));
}

function formatAmount(amount) {
  if (amount === null || amount === undefined || Number.isNaN(amount)) return '—';
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(amount);
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
  const fileInputRef = useRef(null);

  useEffect(() => {
  async function loadDeadlines() {
    const { data, error } = await supabase
      .from('deadlines')
      .select('*')
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

  loadDeadlines();
}, []);

  const monthTotal = useMemo(() => deadlines.reduce((sum, item) => sum + (Number(item.amount) || 0), 0), [deadlines]);
  const nextSevenDays = useMemo(() => deadlines.filter((item) => new Date(item.dueDate) <= new Date('2026-06-29')).length, [deadlines]);

  const extracted = {
    title: 'Bolletta gas',
    provider: 'Hera Comm',
    category: 'Casa',
    dueDate: '2026-06-22',
    amount: 96.8,
    insight: 'Questa sembra una bolletta ricorrente. Potresti voler ricevere un promemoria ogni 2 mesi.',
  };

async function saveExtracted() {
  const { insight, dueDate, ...rest } = extracted;

  const deadline = {
    title: rest.title,
    provider: rest.provider,
    category: rest.category,
    due_date: dueDate,
    amount: rest.amount,
  };

  const { data, error } = await supabase
    .from('deadlines')
    .insert([deadline])
    .select();

  if (error) {
    console.error('Errore salvataggio Supabase:', error);
    alert('Errore nel salvataggio. Controlla la console.');
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
      amount: Number(saved.amount),
    },
    ...deadlines,
  ]);

  setShowExtraction(false);
  setShowEmailPaste(false);
  setEmailText('');
}

  async function saveManual() {
  if (!manualTitle || !manualDate) return;

  const deadline = {
    title: manualTitle,
    provider: 'Inserito manualmente',
    category: 'Altro',
    due_date: manualDate,
    amount: manualAmount ? Number(manualAmount) : null,
  };

  const { data, error } = await supabase
    .from('deadlines')
    .insert([deadline])
    .select();

  if (error) {
    console.error('Errore salvataggio manuale:', error);
    alert('Errore durante il salvataggio.');
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
    alert('Errore durante eliminazione.');
    return;
  }

  setDeadlines(deadlines.filter((item) => item.id !== id));
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
    alert('Errore durante la modifica.');
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
}



  function startFakeAnalysis(fileName = 'bolletta-luce.pdf') {
  setUploadedFileName(fileName);
  setShowExtraction(false);
  setIsAnalyzing(true);

  setTimeout(() => {
    setIsAnalyzing(false);
    setShowExtraction(true);
  }, 2200);
}

  return (
    <main className="page">
      <div className="shell">
        <header className="header">
          <div>
            <div className="brand-row">
  <h1>ScadenzeFacili</h1>
  <span className="beta-badge">Beta privata</span>
</div>
<p>Non dimenticare più bollette, bolli e documenti.</p>
          </div>
          <div className="trust-pill"><ShieldCheck size={16} /> Documento eliminabile dopo l'estrazione</div>
        </header>

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
    startFakeAnalysis(file?.name || 'documento.pdf');
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
      startFakeAnalysis(file.name);
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
            <p>Per esempio una comunicazione di pagamento, rinnovo o scadenza.</p>
            <textarea placeholder="Incolla qui il testo della mail..." value={emailText} onChange={(e) => setEmailText(e.target.value)} />
            <button className="primary small" onClick={() => setShowExtraction(true)}>Analizza testo</button>
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
      <div>✓ Lettura PDF completata</div>
      <div>✓ Data scadenza trovata</div>
      <div>✓ Importo identificato</div>
      <div>✓ Categoria classificata</div>
    </div>
  </section>
)}

{showExtraction && (
  <section className="panel extraction">
    <h2>Ho trovato questa scadenza</h2>
    <p>Controlla i dati prima di salvarla. Non salviamo nulla senza conferma.</p>
    <div className="extracted-grid">
      <Info label="Titolo" value={extracted.title} />
      <Info label="Fornitore" value={extracted.provider} />
      <Info label="Categoria" value={extracted.category} />
      <Info label="Scadenza" value={formatDate(extracted.dueDate)} />
      <Info label="Importo" value={formatAmount(extracted.amount)} />
    </div>
    <div className="smart-note"><strong>Nota smart:</strong> {extracted.insight}</div>
    <div className="actions">
      <button className="primary" onClick={saveExtracted}>Conferma e salva</button>
      <button className="secondary" onClick={() => setShowExtraction(false)}>Modifica</button>
      <button className="ghost" onClick={() => setShowExtraction(false)}>Scarta</button>
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
      Carichi un PDF o una foto e ScadenzeFacili trova automaticamente i dati.
    </p>
  </div>

  <div className="benefit-card">
    <h3>Privacy semplice</h3>
    <p>
      Puoi eliminare il documento subito dopo l’estrazione.
    </p>
  </div>
</section>

<section className="roadmap">
  <div className="roadmap-header">
    <h2>Roadmap beta</h2>
    <p>
      Stiamo costruendo ScadenzeFacili insieme ai primi utenti.
    </p>
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
        <strong>Reminder WhatsApp</strong>
        <p>Ricevi notifiche automatiche prima della scadenza.</p>
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
          <Stat icon={<CalendarDays size={20} />} label="Prossimi 7 giorni" value={nextSevenDays} hint="scadenze da controllare" />
          <Stat icon={<FileText size={20} />} label="Uscite previste" value={formatAmount(monthTotal)} hint="importi conosciuti" />
          <Stat icon={<CheckCircle2 size={20} />} label="Reminder" value="Email" hint="push nella versione futura" />
        </section>

        <section className="how-it-works">
  <div className="section-heading">
    <h2>Come funziona</h2>
    <p>Tre passaggi semplici per trasformare un documento in un promemoria.</p>
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
      <p>ScadenzeFacili propone data, importo e categoria automaticamente.</p>
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
      Stiamo cercando i primi utenti per testare
      ScadenzeFacili con scadenze reali.
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
            <input placeholder="Titolo" value={manualTitle} onChange={(e) => setManualTitle(e.target.value)} />
            <input type="date" value={manualDate} onChange={(e) => setManualDate(e.target.value)} />
            <input type="number" placeholder="Importo" value={manualAmount} onChange={(e) => setManualAmount(e.target.value)} />
            <button className="primary" onClick={saveManual}><Plus size={16} /> Salva</button>
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

        <section className="panel">
          <h2>Scadenze salvate</h2>
          <div className="deadline-list">
            {deadlines.slice().sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate)).map((item) => (
              <article key={item.id} className="deadline-row">
                <div>
                  <h3>{item.title}</h3>
                  <p>{item.provider} · {item.category} · {formatDate(item.dueDate)}</p>
                </div>
                <div className="deadline-actions">
                  <strong>{formatAmount(item.amount)}</strong>
<button
  className="icon-button"
  onClick={() => setEditingDeadline(item)}
  aria-label="Modifica scadenza"
>
  <Pencil size={16} />
</button>

<button
  className="icon-button"
  onClick={() => deleteDeadline(item.id)}
  aria-label="Elimina scadenza"
>
  <Trash2 size={16} />
</button>                
              </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

function Info({ label, value }) {
  return <div className="info"><span>{label}</span><strong>{value}</strong></div>;
}

function Stat({ icon, label, value, hint }) {
  return (
    <div className="stat-card">
      <div className="stat-label">{icon} {label}</div>
      <strong>{value}</strong>
      <p>{hint}</p>
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
