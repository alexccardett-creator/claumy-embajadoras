import React, { useState, useRef, useEffect } from 'react';
import { LogIn, LogOut, Upload, Plus, CheckCircle, Clock, User, Lock, DollarSign, AlertCircle, Sparkles, Copy, TrendingUp, Trash2, Download, MessageCircle, Lightbulb } from 'lucide-react';

// --- CONFIGURACIÓN DE FIREBASE Y GEMINI ---
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithCustomToken, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, updateDoc, onSnapshot, getDocs, deleteDoc } from 'firebase/firestore';

// 👇👇👇 1. PON AQUÍ LOS DATOS DE TU BASE DE DATOS FIREBASE 👇👇👇
const firebaseConfig = {
  apiKey: "AIzaSyAazdyBkZakQDfmXMyI9wQNJIjiJqxCNTc",
  authDomain: "claumy-app-5ae90.firebaseapp.com",
  projectId: "claumy-app-5ae90",
  storageBucket: "claumy-app-5ae90.firebasestorage.app",
  messagingSenderId: "896761091426",
  appId: "1:896761091426:web:65b457a8dba82457f7483b",
  measurementId: "G-9ZMFRGT6CE"
};
// 👆👆👆 ======================================================== 👆👆👆

// (Esta línea es por si lo pruebas en la web de IA, si estás en tu ordenador usa la de arriba)
const finalFirebaseConfig = Object.keys(firebaseConfig).length > 0 && firebaseConfig.apiKey !== "TU_API_KEY_DE_FIREBASE_AQUI" ? firebaseConfig : (typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {});

const app = initializeApp(finalFirebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

// 👇👇👇 2. PON AQUÍ TU CLAVE DE GEMINI (IA) 👇👇👇
// ATENCIÓN: Para que funcione AQUÍ en este entorno de pruebas, debe estar vacía ("").
// El entorno inyecta su propia clave automáticamente.
const apiKey = ""; 
// 👆👆👆 ========================================== 👆👆👆

// Función para copiar al portapapeles
const copyToClipboard = (text) => {
  const textArea = document.createElement("textarea");
  textArea.value = text;
  textArea.style.top = "0";
  textArea.style.left = "0";
  textArea.style.position = "fixed";
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();
  try { document.execCommand('copy'); } catch (err) {}
  document.body.removeChild(textArea);
};

// Función para llamar a Gemini API
const callGeminiAPI = async (prompt) => {
  // En este entorno de vista previa, USAMOS el modelo gemini-2.5-flash-preview-09-2025
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;
  const payload = { contents: [{ parts: [{ text: prompt }] }] };
  const delays = [1000, 2000, 4000, 8000, 16000];

  for (let attempt = 0; attempt <= delays.length; attempt++) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      // SI HAY ERROR, LEEMOS EL MENSAJE REAL DE GOOGLE
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `Error de Google: ${response.status}`);
      }
      
      const data = await response.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text || "No se generó respuesta.";
    } catch (error) {
      console.error("Error llamando a Gemini:", error);
      if (attempt === delays.length) {
         return `⚠️ Error detallado: ${error.message}`;
      }
      await new Promise(resolve => setTimeout(resolve, delays[attempt]));
    }
  }
};

const App = () => {
  const [currentView, setCurrentView] = useState('login');
  const [currentUser, setCurrentUser] = useState(null);
  const [notification, setNotification] = useState(null);
  
  // Estados de Base de datos
  const [fbUser, setFbUser] = useState(null);
  const [dbReady, setDbReady] = useState(false);
  const [ambassadors, setAmbassadors] = useState([]);

  // 1. Inicializar Autenticación
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (error) {
        console.error("Error de autenticación:", error);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setFbUser);
    return () => unsubscribe();
  }, []);

  // 2. Escuchar Datos de la Nube (Realtime)
  useEffect(() => {
    if (!fbUser) return;

    const ambassadorsRef = collection(db, 'artifacts', appId, 'public', 'data', 'ambassadors');

    const seedDataAndListen = async () => {
      try {
        // Cargar datos iniciales si la base de datos está vacía (Primera vez)
        const snapshot = await getDocs(ambassadorsRef);
        if (snapshot.empty) {
          const initial = [
            { code: 'emy13', password: '123', accumulated: 150, withdrawn: 50, pendingRequest: 0, newNotification: null },
            { code: 'Olaya', password: '123', accumulated: 20, withdrawn: 0, pendingRequest: 0, newNotification: null },
            { code: 'Nerea', password: '123', accumulated: 300, withdrawn: 200, pendingRequest: 0, newNotification: null },
            { code: 'marta12', password: '123', accumulated: 0, withdrawn: 0, pendingRequest: 0, newNotification: null },
            { code: 'Fany', password: '123', accumulated: 80, withdrawn: 0, pendingRequest: 0, newNotification: null },
          ];
          for (const amb of initial) {
            await setDoc(doc(ambassadorsRef, amb.code), amb);
          }
        }
      } catch (err) {
        console.error("Error inicializando BD:", err);
      }

      // Escuchar cambios en tiempo real
      const unsubscribe = onSnapshot(ambassadorsRef, (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        // Ordenamos alfabéticamente
        data.sort((a, b) => a.code.localeCompare(b.code));
        setAmbassadors(data);
        setDbReady(true);
      }, (error) => {
        console.error("Error Firestore:", error);
      });

      return unsubscribe;
    };

    let unsubFn;
    seedDataAndListen().then(fn => { unsubFn = fn; });
    return () => { if (unsubFn) unsubFn(); };
  }, [fbUser]);


  const showNotification = (msg) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 6000);
  };

  // --- COMPONENTE DE CARGA ---
  if (!dbReady) {
    return (
      <>
        <style>{`
          @import url('https://fonts.cdnfonts.com/css/caviar-dreams');
          * { font-family: 'Caviar Dreams', sans-serif !important; }
        `}</style>
        <div className="min-h-screen flex items-center justify-center bg-pink-50 flex-col font-sans">
          <Sparkles size={40} className="text-pink-400 animate-pulse mb-4" />
          <p className="text-pink-500 font-medium text-lg">Conectando a la base de datos de Claumy...</p>
        </div>
      </>
    );
  }

  // --- COMPONENTE DE LOGIN ---
  const Login = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const handleLogin = (e) => {
      e.preventDefault();
      if (username === 'ADMIN' && password === 'cardet1q12345q') {
        setCurrentUser({ role: 'admin', name: 'Administradora' });
        setCurrentView('admin');
        return;
      }
      const ambassador = ambassadors.find(
        (a) => a.code.toLowerCase() === username.toLowerCase() && a.password === password
      );
      if (ambassador) {
        setCurrentUser({ role: 'ambassador', ...ambassador });
        setCurrentView('ambassador');
      } else {
        setError('Usuario o contraseña incorrectos.');
      }
    };

    return (
      <div className="min-h-screen flex items-center justify-center bg-pink-50 p-4 font-sans">
        <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md border border-pink-100">
          <div className="text-center mb-6 flex flex-col items-center justify-center">
            <div style={{display: 'none'}} className="text-3xl font-bold text-pink-400 tracking-widest mb-4">
              CLAUMY<br/><span className="text-sm font-light text-gray-500">NAILS ACADEMY</span>
            </div>
            {/* Logo principal  */}
            <img 
              src="LOGOTIPO-03.PNG" alt="Claumy Logo Principal" className="h-32 object-contain mb-2"
              onError={(e) => e.target.style.display = 'none'}
            />
          </div>
          <h2 className="text-2xl font-semibold text-center text-gray-800 mb-6">Iniciar Sesión</h2>
          {error && (
            <div className="bg-red-50 text-red-500 p-3 rounded-lg text-sm mb-4 flex items-center">
              <AlertCircle size={16} className="mr-2" /> {error}
            </div>
          )}
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Usuario / Código</label>
              <div className="relative">
                <User size={18} className="absolute left-3 top-3 text-pink-300" />
                <input
                  type="text" value={username} onChange={(e) => setUsername(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-pink-200 rounded-lg focus:ring-2 focus:ring-pink-300 outline-none"
                  placeholder="Ej: emy13 o ADMIN" required
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña</label>
              <div className="relative">
                <Lock size={18} className="absolute left-3 top-3 text-pink-300" />
                <input
                  type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-pink-200 rounded-lg focus:ring-2 focus:ring-pink-300 outline-none"
                  placeholder="••••••••" required
                />
              </div>
            </div>
            <button type="submit" className="w-full bg-pink-400 hover:bg-pink-500 text-white font-medium py-2.5 rounded-lg transition-colors flex items-center justify-center mt-2">
              <LogIn size={18} className="mr-2" /> Entrar
            </button>
          </form>
        </div>
      </div>
    );
  };

  // --- COMPONENTE DE ADMINISTRADOR ---
  const AdminDashboard = () => {
    const fileInputRef = useRef(null);
    const [manualAmount, setManualAmount] = useState('');
    const [selectedAmbassador, setSelectedAmbassador] = useState('');
    
    // IA States
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [aiInsights, setAiInsights] = useState('');
    
    const [msgAmbassador, setMsgAmbassador] = useState('');
    const [generatedMsg, setGeneratedMsg] = useState('');
    const [isGeneratingMsg, setIsGeneratingMsg] = useState(false);

    // Estados para crear embajadoras
    const [newAmbassadorCode, setNewAmbassadorCode] = useState('');
    const [newAmbassadorPass, setNewAmbassadorPass] = useState('');

    // Estado para confirmar eliminación
    const [ambassadorToDelete, setAmbassadorToDelete] = useState(null);

    const handleLogout = () => { setCurrentUser(null); setCurrentView('login'); };

    const handleAddManual = async (e) => {
      e.preventDefault();
      if (!selectedAmbassador || !manualAmount) return;
      const amount = parseFloat(manualAmount);
      if (isNaN(amount) || amount <= 0) return showNotification("⚠️ Monto inválido. Debe ser mayor a 0.");
      
      try {
        const targetAmb = ambassadors.find(a => a.code === selectedAmbassador);
        const ambRef = doc(db, 'artifacts', appId, 'public', 'data', 'ambassadors', selectedAmbassador);
        await updateDoc(ambRef, { accumulated: targetAmb.accumulated + amount });
        
        showNotification(`Se añadieron ${amount}€ a ${selectedAmbassador} en la base de datos.`);
        setManualAmount(''); setSelectedAmbassador('');
      } catch (err) {
        showNotification("Error al guardar en la nube.");
      }
    };

    const handleApproveWithdrawal = async (code, amount) => {
      try {
        const targetAmb = ambassadors.find(a => a.code === code);
        const ambRef = doc(db, 'artifacts', appId, 'public', 'data', 'ambassadors', code);
        await updateDoc(ambRef, { 
          withdrawn: targetAmb.withdrawn + amount, 
          pendingRequest: 0,
          newNotification: `¡Buenas noticias! Tu saldo de ${amount.toFixed(2)}€ ya ha sido depositado como Tarjeta de Regalo o Saldo en la tienda. ¡A disfrutarlo!`
        });
        showNotification(`Retiro aprobado para ${code}. ¡Agrégale el saldo en Shopify!`);
      } catch (err) {
        showNotification("Error al aprobar en la nube.");
      }
    };

    const handleChangePassword = async (code, newPass) => {
      if(!newPass) return;
      const targetAmb = ambassadors.find(a => a.code === code);
      if(targetAmb.password === newPass) return;

      try {
        const ambRef = doc(db, 'artifacts', appId, 'public', 'data', 'ambassadors', code);
        await updateDoc(ambRef, { password: newPass });
        showNotification(`Contraseña de ${code} actualizada en la nube.`);
      } catch (err) {
        console.error(err);
      }
    };

    const handleFileUpload = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      
      reader.onload = async (event) => {
        const lines = event.target.result.split('\n');
        const updatesMap = {};
        const newAmbassadorsMap = {};
        
        lines.forEach(line => {
          const columns = line.split(/[,;]/);
          let potentialCode = null; 
          let foundAmount = 0;
          
          columns.forEach(col => {
            const cell = col.trim().replace(/['"]/g, '');
            const num = parseFloat(cell);
            
            if (!isNaN(num) && num < 0) {
              foundAmount = Math.abs(num);
            } 
            else if (cell !== '' && isNaN(num) && !cell.toLowerCase().includes('código') && !cell.toLowerCase().includes('descuento') && !cell.toLowerCase().includes('aplicados')) {
              if (!potentialCode) potentialCode = cell;
            }
          });

          if (potentialCode && foundAmount > 0) {
            const existingAmb = ambassadors.find(a => a.code.toLowerCase() === potentialCode.toLowerCase());
            if (existingAmb) {
              if (!updatesMap[existingAmb.code]) updatesMap[existingAmb.code] = 0;
              updatesMap[existingAmb.code] += foundAmount;
            } else {
              if (!newAmbassadorsMap[potentialCode]) newAmbassadorsMap[potentialCode] = 0;
              newAmbassadorsMap[potentialCode] += foundAmount;
            }
          }
        });

        let updatesCount = 0; 
        let newCount = 0; 
        let totalAdded = 0;
        
        for (const code of Object.keys(updatesMap)) {
           const amountToAdd = updatesMap[code];
           const targetAmb = ambassadors.find(a => a.code === code);
           if (targetAmb) {
             const ambRef = doc(db, 'artifacts', appId, 'public', 'data', 'ambassadors', targetAmb.code);
             try {
               await updateDoc(ambRef, { accumulated: targetAmb.accumulated + amountToAdd });
               updatesCount++;
               totalAdded += amountToAdd;
             } catch (err) {
               console.error("Error actualizando", code, err);
             }
           }
        }

        for (const code of Object.keys(newAmbassadorsMap)) {
           const initialAmount = newAmbassadorsMap[code];
           const ambRef = doc(db, 'artifacts', appId, 'public', 'data', 'ambassadors', code);
           try {
             await setDoc(ambRef, {
               code: code,
               password: '123',
               accumulated: initialAmount,
               withdrawn: 0,
               pendingRequest: 0,
               newNotification: null
             });
             newCount++;
             totalAdded += initialAmount;
           } catch (err) {
             console.error("Error creando nueva embajadora", code, err);
           }
        }

        showNotification(`CSV: ${updatesCount} actualizadas, ${newCount} nuevas creadas (${totalAdded.toFixed(2)}€ sumados)`);
        if(fileInputRef.current) fileInputRef.current.value = '';
      };
      reader.readAsText(file);
    };

    // Funciones IA del Admin
    const handleGenerateInsights = async () => {
      setIsAnalyzing(true);
      const dataResumen = ambassadors.map(a => `${a.code}: ha generado ${a.accumulated}€`).join(', ');
      const prompt = `Eres una experta en marketing y mentora de negocios para 'Claumy', una marca de productos de uñas. 
      Aquí tienes los datos de ventas de nuestras embajadoras este año: ${dataResumen}. 
      Escribe un párrafo corto (máximo 4 líneas) resaltando quién es la mejor embajadora, qué patrón ves y dame un consejo breve de una promoción que podría hacer la marca Claumy para ayudar a las que han vendido menos a arrancar. Tono profesional, motivador y directo.`;
      
      const response = await callGeminiAPI(prompt);
      setAiInsights(response);
      setIsAnalyzing(false);
    };

    const handleGenerateMotivationalMessage = async () => {
      if (!msgAmbassador) return showNotification("⚠️ Selecciona una embajadora primero.");
      setIsGeneratingMsg(true);
      const amb = ambassadors.find(a => a.code === msgAmbassador);
      const prompt = `Actúa como la dueña de 'Claumy Nails Academy'. Escribe un mensaje de WhatsApp directo, cariñoso y motivador para tu embajadora "${amb.code}". Hasta ahora ha generado ${amb.accumulated.toFixed(2)}€ en ventas. Felicítala si ha vendido mucho, o dale ánimos y consejos para promocionarse si ha vendido poco o nada. Menciónale que su código es "${amb.code}". Mantenlo breve (3-4 líneas) y usa emojis.`;
      
      const response = await callGeminiAPI(prompt);
      setGeneratedMsg(response);
      setIsGeneratingMsg(false);
    };

    const handleCopyAdminMsg = () => {
      copyToClipboard(generatedMsg);
      showNotification("¡Mensaje copiado al portapapeles!");
    };

    const handleDownloadTemplate = () => {
      const csvContent = "data:text/csv;charset=utf-8,Código de descuento,Descuentos aplicados\nemy13,-15.50\nNerea,-20.00\nEjemploNuevo,-5.00";
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", "plantilla_claumy.csv");
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    };

    const handleAddAmbassador = async (e) => {
      e.preventDefault();
      if (!newAmbassadorCode || !newAmbassadorPass) return;
      const codeTrimmed = newAmbassadorCode.trim();

      if (ambassadors.find(a => a.code.toLowerCase() === codeTrimmed.toLowerCase())) {
         return showNotification("⚠️ Esta embajadora ya existe en el sistema.");
      }

      try {
        const ambRef = doc(db, 'artifacts', appId, 'public', 'data', 'ambassadors', codeTrimmed);
        await setDoc(ambRef, {
          code: codeTrimmed,
          password: newAmbassadorPass,
          accumulated: 0,
          withdrawn: 0,
          pendingRequest: 0,
          newNotification: null
        });
        showNotification(`Embajadora ${codeTrimmed} creada con éxito.`);
        setNewAmbassadorCode('');
        setNewAmbassadorPass('');
      } catch(err) {
        showNotification("Error al crear la embajadora en la nube.");
      }
    };

    const executeDeleteAmbassador = async () => {
      if (!ambassadorToDelete) return;
      try {
         await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'ambassadors', ambassadorToDelete));
         showNotification(`✅ Embajadora ${ambassadorToDelete} eliminada.`);
      } catch(err) {
         showNotification("⚠️ Error al eliminar la embajadora.");
      }
      setAmbassadorToDelete(null);
    };

    const pendingCount = ambassadors.filter(a => a.pendingRequest > 0).length;

    return (
      <div className="min-h-screen bg-gray-50 pb-10">
        <header className="bg-white shadow-sm border-b border-pink-100 px-6 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-3">
             {/* Se usa LOGOTIPO-05.png. Reemplaza el archivo en tu carpeta public si quieres cambiarlo */}
             <img src="LOGOTIPO-05.png" alt="Logo" className="h-8 object-contain opacity-80" onError={(e) => e.target.style.display = 'none'} />
             <h1 className="text-xl font-bold text-gray-800 hidden sm:block">Panel de Administración</h1>
          </div>
          <button onClick={handleLogout} className="flex items-center text-gray-600 hover:text-pink-500 transition-colors">
            <LogOut size={18} className="mr-1" /> Salir
          </button>
        </header>

        {pendingCount > 0 && (
          <div className="max-w-6xl mx-auto mt-4 px-4">
            <div className="bg-orange-50 text-orange-800 p-4 rounded-lg border border-orange-200 flex items-center justify-between shadow-sm">
              <div className="flex items-center">
                <AlertCircle size={22} className="mr-3 text-orange-500" />
                <span className="font-medium">
                  ¡Atención! Tienes {pendingCount} {pendingCount === 1 ? 'embajadora' : 'embajadoras'} que han solicitado retirar su saldo.
                </span>
              </div>
            </div>
          </div>
        )}

        {notification && (
          <div className="max-w-6xl mx-auto mt-4 px-4">
            <div className="bg-green-50 text-green-700 p-4 rounded-lg border border-green-200 flex items-center">
              <CheckCircle size={20} className="mr-2" /> {notification}
            </div>
          </div>
        )}

        <main className="max-w-6xl mx-auto mt-8 px-4 grid grid-cols-1 md:grid-cols-4 gap-6">
          {/* Controles del administrador */}
          <div className="space-y-6 md:col-span-1">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                <Plus size={20} className="mr-2 text-pink-400" /> Añadir Saldo
              </h3>
              <form onSubmit={handleAddManual} className="space-y-4">
                <div>
                  <select 
                    value={selectedAmbassador} onChange={(e) => setSelectedAmbassador(e.target.value)}
                    className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:border-pink-300" required
                  >
                    <option value="">Selecciona...</option>
                    {ambassadors.map(a => <option key={a.id} value={a.code}>{a.code}</option>)}
                  </select>
                </div>
                <div>
                  <input 
                    type="number" step="0.01" value={manualAmount} onChange={(e) => setManualAmount(e.target.value)}
                    className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:border-pink-300" placeholder="Monto (€)" required
                  />
                </div>
                <button type="submit" className="w-full bg-gray-800 hover:bg-gray-900 text-white py-2 rounded-lg transition-colors">Guardar</button>
              </form>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                <User size={20} className="mr-2 text-pink-400" /> Nueva Embajadora
              </h3>
              <form onSubmit={handleAddAmbassador} className="space-y-4">
                <div>
                  <input 
                    type="text" value={newAmbassadorCode} onChange={(e) => setNewAmbassadorCode(e.target.value)}
                    className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:border-pink-300 text-sm" placeholder="Código (ej: maria24)" required
                  />
                </div>
                <div>
                  <input 
                    type="password" value={newAmbassadorPass} onChange={(e) => setNewAmbassadorPass(e.target.value)}
                    className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:border-pink-300 text-sm" placeholder="••••••••" required
                  />
                </div>
                <button type="submit" className="w-full bg-pink-500 hover:bg-pink-600 text-white py-2 rounded-lg transition-colors text-sm font-medium">Crear Embajadora</button>
              </form>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                <Upload size={20} className="mr-2 text-pink-400" /> Carga CSV
              </h3>
              <input type="file" accept=".csv" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
              <button onClick={() => fileInputRef.current.click()} className="w-full border-2 border-dashed border-pink-300 text-pink-500 hover:bg-pink-50 py-3 rounded-lg transition-colors flex items-center justify-center font-medium mb-3">
                <Upload size={18} className="mr-2" /> Seleccionar CSV
              </button>
              <button onClick={handleDownloadTemplate} className="w-full text-sm text-gray-500 hover:text-pink-600 flex items-center justify-center transition-colors">
                <Download size={16} className="mr-1" /> Descargar plantilla
              </button>
            </div>
          </div>

          {/* Área principal: IA y Tabla */}
          <div className="md:col-span-3 space-y-6">
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Bloque IA 1: Asesoría Global */}
              <div className="bg-gradient-to-br from-indigo-50 to-purple-50 p-6 rounded-2xl shadow-sm border border-indigo-100">
                 <h3 className="text-lg font-semibold text-indigo-900 mb-2 flex items-center">
                  <TrendingUp size={20} className="mr-2 text-indigo-500" /> Asesoría Global ✨
                </h3>
                <p className="text-sm text-indigo-700 mb-4">Analiza el rendimiento general de las embajadoras.</p>
                <button 
                  onClick={handleGenerateInsights} disabled={isAnalyzing}
                  // Botón cambiado a blanco con texto índigo
                  className="w-full bg-white text-indigo-600 border border-indigo-200 hover:bg-indigo-50 py-2.5 rounded-lg transition-colors flex items-center justify-center font-medium shadow-sm disabled:opacity-70"
                >
                  {isAnalyzing ? <Clock className="animate-spin mr-2" size={18}/> : <Sparkles className="mr-2" size={18}/>}
                  {isAnalyzing ? 'Analizando...' : 'Generar Análisis'}
                </button>
                {aiInsights && (
                  <div className="mt-4 p-4 bg-white/80 rounded-xl text-sm text-gray-700 leading-relaxed border border-indigo-200">
                    {aiInsights}
                  </div>
                )}
              </div>

              {/* Bloque IA 2: Redactor de Mensajes Motivacionales */}
              <div className="bg-gradient-to-br from-emerald-50 to-teal-50 p-6 rounded-2xl shadow-sm border border-emerald-100">
                 <h3 className="text-lg font-semibold text-emerald-900 mb-2 flex items-center">
                  <MessageCircle size={20} className="mr-2 text-emerald-500" /> Redactor de Mensajes ✨
                </h3>
                <p className="text-sm text-emerald-700 mb-4">La IA redactará un WhatsApp motivador personalizado.</p>
                
                <div className="flex gap-2 mb-3">
                  <select 
                      value={msgAmbassador} onChange={(e) => setMsgAmbassador(e.target.value)}
                      className="flex-1 p-2 border border-emerald-200 rounded-lg outline-none focus:border-emerald-400 text-sm"
                    >
                      <option value="">Elegir embajadora...</option>
                      {ambassadors.map(a => <option key={a.id} value={a.code}>{a.code}</option>)}
                  </select>
                  <button 
                    onClick={handleGenerateMotivationalMessage} disabled={isGeneratingMsg}
                    // Botón cambiado a blanco con texto esmeralda
                    className="bg-white text-emerald-600 border border-emerald-200 hover:bg-emerald-50 px-4 rounded-lg transition-colors flex items-center justify-center shadow-sm disabled:opacity-70"
                  >
                    {isGeneratingMsg ? <Clock className="animate-spin" size={18}/> : <Sparkles size={18}/>}
                  </button>
                </div>
                
                {generatedMsg && (
                  <div className="relative group">
                    <div className="mt-2 p-3 bg-white/80 rounded-xl text-sm text-gray-700 whitespace-pre-wrap border border-emerald-200">
                      {generatedMsg}
                    </div>
                    <button onClick={handleCopyAdminMsg} className="absolute top-2 right-2 p-1.5 bg-emerald-100 text-emerald-700 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity" title="Copiar texto">
                      <Copy size={16} />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Tabla de embajadoras */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
               <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                Estado en Tiempo Real <span className="ml-3 flex h-3 w-3"><span className="animate-ping absolute inline-flex h-3 w-3 rounded-full bg-green-400 opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span></span>
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 text-gray-600 text-sm border-b border-gray-100">
                      <th className="p-3 font-medium">Código</th>
                      <th className="p-3 font-medium">Contraseña</th>
                      <th className="p-3 font-medium">Total Generado</th>
                      <th className="p-3 font-medium">Retirado</th>
                      <th className="p-3 font-medium">Saldo Actual</th>
                      <th className="p-3 font-medium">Solicitudes</th>
                      <th className="p-3 font-medium text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ambassadors.map((a) => {
                      const currentBalance = a.accumulated - a.withdrawn;
                      return (
                        <tr key={a.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                          <td className="p-3 font-medium text-pink-500">{a.code}</td>
                          <td className="p-3">
                            <input 
                              type="password" defaultValue={a.password} onBlur={(e) => handleChangePassword(a.code, e.target.value)}
                              className="w-20 text-sm p-1 border border-gray-200 rounded focus:border-pink-300 outline-none"
                            />
                          </td>
                          <td className="p-3 text-gray-700">{a.accumulated.toFixed(2)}€</td>
                          <td className="p-3 text-gray-500">{a.withdrawn.toFixed(2)}€</td>
                          <td className="p-3 font-semibold text-gray-800">{currentBalance.toFixed(2)}€</td>
                          <td className="p-3">
                            {a.pendingRequest > 0 ? (
                              <div className="flex flex-col space-y-2">
                                <span className="text-orange-500 text-sm font-medium">Pide {a.pendingRequest.toFixed(2)}€</span>
                                <button onClick={() => handleApproveWithdrawal(a.code, a.pendingRequest)} className="bg-green-500 hover:bg-green-600 text-white text-xs py-1 px-2 rounded transition-colors">
                                  Aprobar y Pagado
                                </button>
                              </div>
                            ) : <span className="text-gray-400 text-sm">-</span>}
                          </td>
                          <td className="p-3 text-center">
                            <button 
                              onClick={() => setAmbassadorToDelete(a.code)}
                              className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                              title="Eliminar embajadora"
                            >
                              <Trash2 size={18} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Modal de confirmación para eliminar */}
          {ambassadorToDelete && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl border border-pink-100">
                <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-100 mb-4 mx-auto">
                  <AlertCircle className="text-red-600" size={24} />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2 text-center">¿Eliminar embajadora?</h3>
                <p className="text-gray-600 mb-6 text-sm text-center">
                  Estás a punto de eliminar a <b className="text-pink-500">{ambassadorToDelete}</b>. Se perderán todos sus datos y saldos de forma permanente.
                </p>
                <div className="flex gap-3">
                  <button 
                    onClick={() => setAmbassadorToDelete(null)}
                    className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button 
                    onClick={executeDeleteAmbassador}
                    className="flex-1 px-4 py-2.5 bg-red-500 text-white rounded-xl font-medium hover:bg-red-600 transition-colors shadow-sm shadow-red-200"
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            </div>
          )}

        </main>
      </div>
    );
  };

  // --- COMPONENTE DE EMBAJADORA ---
  const AmbassadorDashboard = () => {
    const myData = ambassadors.find(a => a.code === currentUser.code);
    const currentBalance = myData.accumulated - myData.withdrawn;

    // Estados IA 1: Post
    const [aiTopic, setAiTopic] = useState('');
    const [generatedPost, setGeneratedPost] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    
    // Estados IA 2: Ideas de Videos
    const [videoIdeas, setVideoIdeas] = useState('');
    const [isGeneratingIdeas, setIsGeneratingIdeas] = useState(false);

    const [withdrawAmount, setWithdrawAmount] = useState('');

    const handleLogout = () => { setCurrentUser(null); setCurrentView('login'); };

    const handleClearNotification = async () => {
      try {
        const ambRef = doc(db, 'artifacts', appId, 'public', 'data', 'ambassadors', myData.code);
        await updateDoc(ambRef, { newNotification: null });
      } catch (err) {
        console.error("Error al limpiar notif", err);
      }
    };

    const handleRequestWithdrawal = async (amountToWithdraw) => {
      if (currentBalance <= 0) return showNotification("⚠️ No tienes saldo suficiente.");
      if (myData.pendingRequest > 0) return showNotification("⚠️ Ya tienes una solicitud en proceso.");
      if (isNaN(amountToWithdraw) || amountToWithdraw <= 0) return showNotification("⚠️ Por favor, ingresa una cantidad válida mayor a 0.");
      if (amountToWithdraw > currentBalance) return showNotification(`⚠️ No puedes retirar más de tu saldo actual (${currentBalance.toFixed(2)}€).`);

      try {
        const ambRef = doc(db, 'artifacts', appId, 'public', 'data', 'ambassadors', myData.code);
        await updateDoc(ambRef, { pendingRequest: amountToWithdraw });
        setWithdrawAmount('');
        showNotification("Su solicitud se está procesando. Le notificamos por aquí y a su email cuando ya tenga depositado su saldo o su Tarjeta de regalo. ¡MIL GRACIAS POR TU CONTRIBUCIÓN!");
      } catch (err) {
        showNotification("⚠️ Error al conectar con el servidor. Inténtalo de nuevo.");
      }
    };

    return (
      <div className="min-h-screen bg-pink-50 pb-10 font-sans">
        <header className="bg-white shadow-sm px-6 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-3">
             {/* Se usa LOGOTIPO-05.png. Reemplaza el archivo en tu carpeta public si quieres cambiarlo */}
             <img src="LOGOTIPO-05.png" alt="Logo" className="h-8 object-contain opacity-80" onError={(e) => e.target.style.display = 'none'} />
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-600 font-medium">Hola, <span className="text-pink-500">{myData.code}</span></span>
            <button onClick={handleLogout} className="text-gray-500 hover:text-pink-500 transition-colors"><LogOut size={20} /></button>
          </div>
        </header>

        {/* Notificación Permanente de Recordatorio */}
        <div className="max-w-4xl mx-auto mt-6 px-4">
          <div className="bg-pink-100/60 text-pink-900 p-4 rounded-xl border border-pink-200 flex items-start shadow-sm">
            <Sparkles size={24} className="mr-3 flex-shrink-0 mt-0.5 text-pink-500" />
            <div>
              <p className="font-bold text-sm mb-1">¡Recordatorio importante! 💖</p>
              <p className="text-sm font-medium leading-relaxed">
                Recuerda que tienes que compartir contenido 2 veces por semana para poder seguir disfrutando de los beneficios de ser embajadora.
              </p>
            </div>
          </div>
        </div>

        {myData.newNotification && (
          <div className="max-w-4xl mx-auto mt-4 px-4">
            <div className="bg-green-100 text-green-800 p-5 rounded-xl border border-green-300 flex flex-col sm:flex-row justify-between items-center shadow-sm gap-4">
              <div className="flex items-center">
                <Sparkles className="mr-3 text-green-600 flex-shrink-0" size={24} />
                <p className="font-medium text-sm sm:text-base">{myData.newNotification}</p>
              </div>
              <button 
                onClick={handleClearNotification}
                className="text-green-700 hover:text-green-900 font-bold px-4 py-2 bg-green-200/60 hover:bg-green-300 rounded-lg transition-colors whitespace-nowrap flex-shrink-0"
              >
                Entendido
              </button>
            </div>
          </div>
        )}

        {notification && (
          <div className="max-w-4xl mx-auto mt-4 px-4">
            <div className="bg-green-50 text-green-800 p-4 rounded-xl border border-green-200 flex items-start shadow-sm">
              <CheckCircle size={24} className="mr-3 flex-shrink-0 mt-0.5 text-green-500" /> 
              <p className="text-sm font-medium leading-relaxed">{notification}</p>
            </div>
          </div>
        )}

        <main className="max-w-5xl mx-auto mt-8 px-4">
          {/* Tarjetas de Saldos */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-pink-100 flex flex-col items-center text-center">
              <div className="w-12 h-12 bg-pink-100 text-pink-500 rounded-full flex items-center justify-center mb-4"><DollarSign size={24} /></div>
              <p className="text-sm text-gray-500 font-medium mb-1">Saldo Disponible</p>
              <h3 className="text-3xl font-bold text-gray-800">{currentBalance.toFixed(2)}€</h3>
            </div>
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-pink-100 flex flex-col items-center text-center">
              <div className="w-12 h-12 bg-gray-100 text-gray-500 rounded-full flex items-center justify-center mb-4"><Plus size={24} /></div>
              <p className="text-sm text-gray-500 font-medium mb-1">Generado Histórico</p>
              <h3 className="text-2xl font-bold text-gray-700">{myData.accumulated.toFixed(2)}€</h3>
            </div>
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-pink-100 flex flex-col items-center text-center">
              <div className="w-12 h-12 bg-gray-100 text-gray-500 rounded-full flex items-center justify-center mb-4"><CheckCircle size={24} /></div>
              <p className="text-sm text-gray-500 font-medium mb-1">Saldo ya retirado</p>
              <h3 className="text-2xl font-bold text-gray-700">{myData.withdrawn.toFixed(2)}€</h3>
            </div>
          </div>

          <div className="max-w-2xl mx-auto mb-8">
            
            {/* Sección Retiro */}
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-pink-100 flex flex-col justify-center items-center text-center">
              <h3 className="text-xl font-semibold text-gray-800 mb-2">Retirar Saldo</h3>
              <p className="text-gray-600 mb-6 text-sm">
                Solicita saldo para comprar productos en Claumy.
              </p>
              
              {myData.pendingRequest > 0 ? (
                <div className="inline-flex items-center bg-orange-50 text-orange-600 px-6 py-3 rounded-full font-medium border border-orange-200">
                  <Clock size={20} className="mr-2" /> Procesando {myData.pendingRequest.toFixed(2)}€
                </div>
              ) : (
                <div className="w-full space-y-4">
                  <div className="text-left">
                    <input 
                      type="number" step="0.01" max={currentBalance} value={withdrawAmount} onChange={(e) => setWithdrawAmount(e.target.value)}
                      placeholder={`Monto (Máx: ${currentBalance.toFixed(2)}€)`}
                      className="w-full p-3 border border-pink-200 rounded-xl focus:ring-2 focus:ring-pink-400 outline-none"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <button 
                      onClick={() => handleRequestWithdrawal(parseFloat(withdrawAmount))} 
                      className="w-full bg-pink-500 hover:bg-pink-600 text-white py-2.5 px-4 rounded-xl font-medium transition-colors shadow-sm shadow-pink-200"
                    >
                      Retirar monto
                    </button>
                    <button 
                      onClick={() => handleRequestWithdrawal(currentBalance)} 
                      className="w-full bg-gray-800 hover:bg-gray-900 text-white py-2.5 px-4 rounded-xl font-medium transition-colors shadow-sm"
                    >
                      Retirar TODO
                    </button>
                  </div>
                </div>
              )}
            </div>

          </div>
        </main>
      </div>
    );
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.cdnfonts.com/css/caviar-dreams');
        * {
          font-family: 'Caviar Dreams', sans-serif !important;
        }
      `}</style>
      <div className="antialiased text-gray-900">
        {currentView === 'login' && <Login />}
        {currentView === 'admin' && <AdminDashboard />}
        {currentView === 'ambassador' && <AmbassadorDashboard />}
      </div>
    </>
  );
};

export default App;