/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  MapPin, 
  Users, 
  ChevronRight, 
  Leaf, 
  UtensilsCrossed, 
  Info,
  CheckCircle2,
  Menu as MenuIcon,
  X,
  LogIn,
  LogOut,
  Plus,
  Loader2,
  ChevronDown,
  BookOpen,
  ClipboardList
} from 'lucide-react';
import { zones } from './data/zones';
import { tasks } from './data/tasks';
import { Zone, Project, User as AppUser } from './types';
import { auth, db } from './firebase';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  User as FirebaseUser,
  signOut,
  setPersistence,
  browserLocalPersistence
} from 'firebase/auth';
import { 
  collection, 
  addDoc, 
  query, 
  where, 
  onSnapshot,
  serverTimestamp,
  doc,
  getDoc,
  getDocFromServer,
  setDoc,
  updateDoc,
  orderBy
} from 'firebase/firestore';

export default function App() {
  const [selectedZone, setSelectedZone] = useState<Zone | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<Project[]>([]);
  const [allUsers, setAllUsers] = useState<AppUser[]>([]);
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [teamName, setTeamName] = useState('');
  const [isAdminView, setIsAdminView] = useState(false);
  const [expandedTask, setExpandedTask] = useState<string | null>(null);
  const [expandedPart, setExpandedPart] = useState<string | null>(null);
  const [loginError, setLoginError] = useState<string | null>(null);

  useEffect(() => {
    const testConnection = async () => {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error: any) {
        if (error.message?.includes('the client is offline')) {
          console.error("Firestore connection failed: client is offline");
          setLoginError("No se pudo conectar con la base de datos. Verifica tu conexión o la configuración de Firebase.");
        }
      }
    };
    testConnection();
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        if (firebaseUser) {
          const userDocRef = doc(db, 'users', firebaseUser.uid);
          const userDoc = await getDoc(userDocRef);
          
          const isAdminEmail = firebaseUser.email === 'managerproapp@gmail.com' || firebaseUser.email === 'jcbbinger@gmail.com';
          
          if (!userDoc.exists()) {
            const newUser: AppUser = {
              uid: firebaseUser.uid,
              email: firebaseUser.email || '',
              displayName: firebaseUser.displayName || 'Alumno',
              role: isAdminEmail ? 'admin' : 'student',
              status: isAdminEmail ? 'approved' : 'pending',
              createdAt: new Date().toISOString()
            };
            await setDoc(userDocRef, newUser);
            setAppUser(newUser);
          } else {
            setAppUser(userDoc.data() as AppUser);
          }
        } else {
          setAppUser(null);
        }
      } catch (error) {
        console.error("Auth State Error:", error);
        setLoginError("Error al sincronizar el perfil. Por favor, recarga la página.");
      } finally {
        setUser(firebaseUser);
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user || !appUser || (appUser.status !== 'approved' && appUser.role !== 'admin')) {
      setProjects([]);
      return;
    }

    const q = appUser.role === 'admin' 
      ? query(collection(db, 'projects'), orderBy('createdAt', 'desc'))
      : query(collection(db, 'projects'), where('ownerId', '==', user.uid));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const projectsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as unknown as Project[];
      setProjects(projectsData);
    }, (error) => {
      console.error("Firestore Error (Projects):", error);
    });

    return () => unsubscribe();
  }, [user, appUser]);

  useEffect(() => {
    if (!appUser || appUser.role !== 'admin') {
      setAllUsers([]);
      return;
    }

    const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const usersData = snapshot.docs.map(doc => ({
        ...doc.data()
      })) as unknown as AppUser[];
      setAllUsers(usersData);
    }, (error) => {
      console.error("Firestore Error (Users):", error);
    });

    return () => unsubscribe();
  }, [appUser]);

  const handleApproveUser = async (uid: string) => {
    try {
      await updateDoc(doc(db, 'users', uid), { status: 'approved' });
    } catch (error) {
      console.error("Approval Error:", error);
    }
  };

  const handleLogin = async () => {
    setLoading(true);
    setLoginError(null);
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({
      prompt: 'select_account'
    });
    
    try {
      await setPersistence(auth, browserLocalPersistence);
      await signInWithPopup(auth, provider);
    } catch (error: any) {
      console.error("Login Error:", error);
      let message = "No se pudo iniciar sesión. Por favor, inténtalo de nuevo.";
      
      if (error.code === 'auth/popup-blocked') {
        message = "El navegador bloqueó la ventana emergente. Por favor, permite las ventanas emergentes para este sitio.";
      } else if (error.code === 'auth/unauthorized-domain') {
        message = `Este dominio (${window.location.hostname}) no está autorizado en Firebase. Por favor, añádelo en la consola de Firebase (Authentication > Settings > Authorized Domains).`;
      } else if (error.code === 'auth/popup-closed-by-user') {
        message = "Cerraste la ventana de acceso antes de completar el proceso.";
      } else {
        message = `Error (${error.code || 'unknown'}): ${error.message}`;
      }
      
      setLoginError(message);
      setLoading(false);
    }
  };

  const handleLogout = () => signOut(auth);

  const createProject = async (zone: Zone) => {
    if (!user) {
      handleLogin();
      return;
    }
    
    setSelectedZone(zone);
    setIsCreatingProject(true);
  };

  const confirmCreateProject = async () => {
    if (!user || !selectedZone || !teamName.trim()) return;

    try {
      await addDoc(collection(db, 'projects'), {
        teamName,
        zoneId: selectedZone.id,
        ownerId: user.uid,
        members: [{ id: user.uid, name: user.displayName || 'Líder', role: 'Líder' }],
        milestones: [
          { id: '1', title: 'Investigación de Zona', status: 'pending' },
          { id: '2', title: 'Diseño de Menú', status: 'pending' },
          { id: '3', title: 'Presentación Final', status: 'pending' }
        ],
        menu: [],
        createdAt: serverTimestamp()
      });
      setIsCreatingProject(false);
      setSelectedZone(null);
      setTeamName('');
    } catch (error) {
      console.error("Project Creation Error:", error);
    }
  };

  return (
    <div className="min-h-screen bg-[#f5f5f0] font-serif text-[#1a1a1a]">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-[#5A5A40]/10 px-6 py-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-[#5A5A40] rounded-full flex items-center justify-center text-white">
              <Leaf size={20} />
            </div>
            <h1 className="text-xl font-bold tracking-tight hidden sm:block">Sabores de Nuestra Tierra</h1>
            <h1 className="text-xl font-bold tracking-tight sm:hidden">Sabores</h1>
          </div>
          
          <div className="hidden md:flex items-center gap-8 text-sm uppercase tracking-widest font-sans font-medium">
            <button className="hover:text-[#5A5A40] transition-colors">Inicio</button>
            
            {user ? (
              <div className="flex items-center gap-4">
                <div className="flex flex-col items-end">
                  <span className="text-[10px] text-gray-500 lowercase">{user.email}</span>
                  <button onClick={handleLogout} className="text-[#5A5A40] hover:underline">Cerrar Sesión</button>
                </div>
                
                {appUser?.role === 'admin' && (
                  <button 
                    onClick={() => setIsAdminView(!isAdminView)}
                    className="bg-amber-600 text-white px-6 py-2 rounded-full hover:bg-amber-700 transition-colors flex items-center gap-2"
                  >
                    <Info size={16} />
                    {isAdminView ? 'Ver como Alumno' : 'Modo Dios'}
                  </button>
                )}

                <button className="bg-[#5A5A40] text-white px-6 py-2 rounded-full hover:bg-[#4a4a35] transition-colors flex items-center gap-2">
                  <Users size={16} />
                  {appUser?.role === 'admin' ? `Todos los Proyectos (${projects.length})` : `Mis Proyectos (${projects.length})`}
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-end">
                <button 
                  onClick={handleLogin}
                  className="bg-[#5A5A40] text-white px-6 py-2 rounded-full hover:bg-[#4a4a35] transition-colors flex items-center gap-2 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                >
                  <LogIn size={16} />
                  Acceso con Google
                </button>
                <span className="text-[9px] text-gray-400 mt-1 uppercase tracking-tighter">Solo para alumnos registrados</span>
              </div>
            )}
          </div>

          <button className="md:hidden" onClick={() => setIsMenuOpen(true)}>
            <MenuIcon size={24} />
          </button>
        </div>
      </nav>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div 
            initial={{ opacity: 0, x: '100%' }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: '100%' }}
            className="fixed inset-0 z-[60] bg-white p-8 flex flex-col gap-8"
          >
            <button className="self-end" onClick={() => setIsMenuOpen(false)}>
              <X size={32} />
            </button>
            <div className="flex flex-col gap-6 text-2xl font-bold">
              <button onClick={() => setIsMenuOpen(false)}>Inicio</button>
              <button onClick={() => setIsMenuOpen(false)}>Zonas</button>
              <button onClick={() => setIsMenuOpen(false)}>Metodología</button>
              {!user && (
                <button 
                  className="bg-[#5A5A40] text-white px-6 py-4 rounded-2xl flex items-center justify-center gap-2" 
                  onClick={() => {
                    handleLogin();
                    setIsMenuOpen(false);
                  }}
                >
                  <LogIn size={20} />
                  Acceso con Google
                </button>
              )}
              {user && (
                <button className="bg-[#5A5A40] text-white px-6 py-4 rounded-2xl" onClick={() => setIsMenuOpen(false)}>
                  Mi Proyecto
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content Area */}
      {!user ? (
        <main>
          <header className="relative min-h-[90vh] flex items-center justify-center overflow-hidden">
            <div className="absolute inset-0 z-0">
              <img 
                src="https://picsum.photos/seed/murcia-gastronomy/1920/1080" 
                alt="Gastronomía de Murcia" 
                className="w-full h-full object-cover opacity-40"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#f5f5f0]/50 to-[#f5f5f0]"></div>
            </div>
            
            <div className="relative z-10 text-center px-6 max-w-5xl">
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 1 }}
              >
                <span className="uppercase tracking-[0.4em] text-sm font-sans font-bold text-[#5A5A40] mb-6 block">
                  Proyecto Educativo Interdisciplinar
                </span>
                <h2 className="text-7xl md:text-9xl font-bold mb-8 leading-tight tracking-tighter">
                  Sabores de <br />
                  <span className="italic font-light serif">Nuestra Tierra</span>
                </h2>
                <div className="w-24 h-1 bg-[#5A5A40] mx-auto mb-10 opacity-30"></div>
                <p className="text-2xl md:text-3xl text-[#4a4a4a] mb-12 max-w-3xl mx-auto leading-relaxed font-light">
                  Una plataforma exclusiva para alumnos de Hostelería y Turismo. 
                  Explora la riqueza gastronómica de la Región de Murcia a través de la sostenibilidad y la tradición.
                </p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
                  <button 
                    onClick={handleLogin}
                    className="bg-[#5A5A40] text-white px-12 py-5 rounded-full text-xl font-sans font-bold hover:bg-[#4a4a35] transition-all shadow-2xl hover:shadow-emerald-900/20 hover:-translate-y-1 flex items-center gap-3"
                  >
                    <LogIn size={24} />
                    Entrar al Proyecto
                  </button>
                </div>

                {loginError && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-8 p-8 bg-red-50 border border-red-200 rounded-[2rem] text-red-900 max-w-2xl mx-auto text-left"
                  >
                    <div className="flex items-center gap-3 mb-4 text-red-600">
                      <Info size={24} />
                      <p className="font-sans font-bold text-sm uppercase tracking-widest">Guía de Solución de Problemas</p>
                    </div>
                    
                    <p className="text-lg font-bold mb-4">{loginError}</p>
                    
                    <div className="space-y-4 text-sm bg-white/50 p-6 rounded-2xl border border-red-100">
                      <p className="font-bold">Para que el acceso funcione fuera de esta pantalla, debes autorizar estos DOS dominios en Firebase:</p>
                      
                      <div className="space-y-2 mb-4">
                        <div className="flex items-center justify-between bg-white p-2 rounded border border-red-100">
                          <code className="font-mono text-xs">ais-dev-p32wlekctcjsvoilj4our3-633776591902.europe-west2.run.app</code>
                          <button 
                            onClick={() => navigator.clipboard.writeText('ais-dev-p32wlekctcjsvoilj4our3-633776591902.europe-west2.run.app')}
                            className="text-[10px] bg-gray-100 px-2 py-1 rounded hover:bg-gray-200"
                          >
                            Copiar
                          </button>
                        </div>
                        <div className="flex items-center justify-between bg-white p-2 rounded border border-red-100">
                          <code className="font-mono text-xs">ais-pre-p32wlekctcjsvoilj4our3-633776591902.europe-west2.run.app</code>
                          <button 
                            onClick={() => navigator.clipboard.writeText('ais-pre-p32wlekctcjsvoilj4our3-633776591902.europe-west2.run.app')}
                            className="text-[10px] bg-gray-100 px-2 py-1 rounded hover:bg-gray-200"
                          >
                            Copiar
                          </button>
                        </div>
                      </div>

                      <ol className="list-decimal ml-5 space-y-2">
                        <li>Ve a tu <a href="https://console.firebase.google.com/project/ai-studio-applet-webapp-8e3be/authentication/settings" target="_blank" rel="noopener noreferrer" className="underline font-bold text-red-600">Consola de Firebase (Sección Dominios)</a>.</li>
                        <li>Haz clic en <strong>Añadir dominio</strong>.</li>
                        <li>Pega el primero, dale a añadir, y luego repite con el segundo.</li>
                        <li>Espera 30 segundos y recarga la web externa.</li>
                      </ol>
                    </div>

                    <div className="flex gap-4 mt-6">
                      <button 
                        onClick={() => setLoginError(null)}
                        className="bg-red-600 text-white px-6 py-2 rounded-full text-sm font-bold hover:bg-red-700 transition-colors"
                      >
                        Entendido
                      </button>
                      <button 
                        onClick={() => window.location.reload()}
                        className="bg-white text-red-600 border border-red-200 px-6 py-2 rounded-full text-sm font-bold hover:bg-red-50 transition-colors"
                      >
                        Recargar Página
                      </button>
                    </div>
                  </motion.div>
                )}
                <p className="mt-8 text-sm text-gray-500 font-sans uppercase tracking-widest">
                  Acceso restringido mediante cuenta de Google
                </p>
              </motion.div>
            </div>
          </header>

          <section className="py-32 px-6 bg-white">
            <div className="max-w-7xl mx-auto grid md:grid-cols-3 gap-16">
              <div className="space-y-6">
                <div className="w-16 h-16 bg-[#f5f5f0] rounded-2xl flex items-center justify-center text-[#5A5A40]">
                  <MapPin size={32} />
                </div>
                <h3 className="text-3xl font-bold">Investigación Regional</h3>
                <p className="text-xl text-gray-600 leading-relaxed">
                  Analiza las comarcas de Murcia, sus productos locales y la herencia culinaria que define nuestra identidad.
                </p>
              </div>
              <div className="space-y-6">
                <div className="w-16 h-16 bg-[#f5f5f0] rounded-2xl flex items-center justify-center text-[#5A5A40]">
                  <Leaf size={32} />
                </div>
                <h3 className="text-3xl font-bold">Sostenibilidad Real</h3>
                <p className="text-xl text-gray-600 leading-relaxed">
                  Aprende a diseñar menús que respeten el medio ambiente, priorizando el producto de proximidad y el residuo cero.
                </p>
              </div>
              <div className="space-y-6">
                <div className="w-16 h-16 bg-[#f5f5f0] rounded-2xl flex items-center justify-center text-[#5A5A40]">
                  <Users size={32} />
                </div>
                <h3 className="text-3xl font-bold">Trabajo en Equipo</h3>
                <p className="text-xl text-gray-600 leading-relaxed">
                  Colabora con tus compañeros en la creación de una propuesta gastronómica profesional y coherente.
                </p>
              </div>
            </div>
          </section>
        </main>
      ) : appUser?.status === 'pending' && appUser?.role !== 'admin' ? (
        <div className="min-h-[85vh] flex items-center justify-center px-6">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white p-16 rounded-[4rem] shadow-2xl max-w-3xl text-center border border-amber-100"
          >
            <div className="w-24 h-24 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-10">
              <Loader2 className="animate-spin" size={48} />
            </div>
            <h2 className="text-5xl font-bold mb-8">Cuenta en Revisión</h2>
            <p className="text-2xl text-[#4a4a4a] leading-relaxed mb-10">
              Bienvenido, <strong>{user.displayName}</strong>. <br />
              Tu registro se ha completado con éxito, pero el acceso a los contenidos del proyecto debe ser aprobado manualmente por el profesor.
            </p>
            <div className="bg-[#f5f5f0] p-8 rounded-3xl mb-10">
              <p className="text-lg text-[#5A5A40] font-medium">
                Por favor, avisa a tu profesor en clase para que active tu perfil en el panel de control.
              </p>
            </div>
            <button 
              onClick={handleLogout}
              className="text-[#5A5A40] font-sans font-bold uppercase tracking-[0.2em] text-sm hover:underline flex items-center gap-2 mx-auto"
            >
              <LogOut size={16} />
              Cerrar Sesión
            </button>
          </motion.div>
        </div>
      ) : isAdminView ? (
        <div className="py-24 px-6 max-w-7xl mx-auto">
          <div className="flex justify-between items-end mb-16">
            <div>
              <h2 className="text-5xl font-bold mb-4">Panel de Administración</h2>
              <p className="text-xl text-gray-500">Gestiona los alumnos y supervisa todos los proyectos regionales.</p>
            </div>
            <div className="bg-amber-100 text-amber-800 px-6 py-2 rounded-full font-sans font-bold text-sm uppercase tracking-widest">
              Modo Dios Activo
            </div>
          </div>

          <div className="grid lg:grid-cols-3 gap-12">
            <div className="lg:col-span-1 space-y-8">
              <h3 className="text-2xl font-bold flex items-center gap-2">
                <Users className="text-[#5A5A40]" />
                Alumnos Registrados
              </h3>
              <div className="space-y-4">
                {allUsers.filter(u => u.role !== 'admin').map((u) => (
                  <div key={u.uid} className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex justify-between items-center">
                    <div>
                      <p className="font-bold">{u.displayName}</p>
                      <p className="text-xs text-gray-500">{u.email}</p>
                      <span className={`text-[10px] uppercase font-bold tracking-tighter ${u.status === 'approved' ? 'text-green-600' : 'text-amber-600'}`}>
                        {u.status === 'approved' ? 'Aprobado' : 'Pendiente'}
                      </span>
                    </div>
                    {u.status === 'pending' && (
                      <button 
                        onClick={() => handleApproveUser(u.uid)}
                        className="bg-green-600 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-green-700 transition-colors"
                      >
                        Aprobar
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="lg:col-span-2 space-y-8">
              <h3 className="text-2xl font-bold flex items-center gap-2">
                <UtensilsCrossed className="text-[#5A5A40]" />
                Proyectos en Curso
              </h3>
              <div className="grid sm:grid-cols-2 gap-6">
                {projects.map((p) => (
                  <div key={p.id} className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100">
                    <div className="flex justify-between items-start mb-4">
                      <h4 className="text-xl font-bold">{p.teamName}</h4>
                      <span className="bg-[#f5f5f0] px-3 py-1 rounded-full text-[10px] font-bold uppercase">
                        {zones.find(z => z.id === p.zoneId)?.name}
                      </span>
                    </div>
                    <div className="space-y-3">
                      {p.milestones.map((m) => (
                        <div key={m.id} className="flex items-center gap-2 text-sm">
                          <div className={`w-2 h-2 rounded-full ${m.status === 'completed' ? 'bg-green-500' : 'bg-gray-300'}`} />
                          <span className={m.status === 'completed' ? 'text-gray-400 line-through' : ''}>{m.title}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <>
          <header className="relative h-[70vh] flex items-center justify-center overflow-hidden">
            <div className="absolute inset-0 z-0">
              <img 
                src="https://picsum.photos/seed/murcia-landscape/1920/1080" 
                alt="Paisaje de Murcia" 
                className="w-full h-full object-cover opacity-60"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[#f5f5f0]"></div>
            </div>
            
            <div className="relative z-10 text-center px-6 max-w-4xl">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8 }}
              >
                <span className="uppercase tracking-[0.3em] text-sm font-sans font-semibold text-[#5A5A40] mb-4 block">
                  Región de Murcia
                </span>
                <h2 className="text-6xl md:text-8xl font-bold mb-6 leading-tight">
                  Sabores de <br />
                  <span className="italic font-light">Nuestra Tierra</span>
                </h2>
                <p className="text-xl md:text-2xl text-[#4a4a4a] mb-10 max-w-2xl mx-auto leading-relaxed">
                  Un viaje gastronómico por la sostenibilidad y la tradición de nuestras comarcas.
                </p>
                <button className="bg-[#5A5A40] text-white px-10 py-4 rounded-full text-lg font-sans font-semibold hover:bg-[#4a4a35] transition-all shadow-xl hover:shadow-2xl hover:-translate-y-1">
                  Explorar el Mapa
                </button>
              </motion.div>
            </div>
          </header>

          {/* Tasks Section */}
          <section className="py-24 px-6 max-w-5xl mx-auto">
            <div className="flex items-center gap-4 mb-12">
              <div className="w-12 h-12 bg-[#5A5A40] text-white rounded-2xl flex items-center justify-center">
                <ClipboardList size={24} />
              </div>
              <div>
                <h3 className="text-4xl font-bold">Tareas del Proyecto</h3>
                <p className="text-[#5A5A40] font-sans font-bold uppercase tracking-widest text-xs mt-1">Guía paso a paso para tu equipo</p>
              </div>
            </div>

            <div className="space-y-6">
              {tasks.map((task) => (
                <div key={task.id} className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden">
                  <button 
                    onClick={() => setExpandedTask(expandedTask === task.id ? null : task.id)}
                    className="w-full px-10 py-8 flex items-center justify-between hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <BookOpen className="text-[#5A5A40]" size={24} />
                      <h4 className="text-2xl font-bold text-left">{task.title}</h4>
                    </div>
                    <motion.div
                      animate={{ rotate: expandedTask === task.id ? 180 : 0 }}
                    >
                      <ChevronDown size={24} />
                    </motion.div>
                  </button>

                  <AnimatePresence>
                    {expandedTask === task.id && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="border-t border-gray-100"
                      >
                        <div className="p-8 space-y-4">
                          {task.parts.map((part) => (
                            <div key={part.id} className="bg-[#f5f5f0] rounded-3xl overflow-hidden">
                              <button 
                                onClick={() => setExpandedPart(expandedPart === part.id ? null : part.id)}
                                className="w-full px-8 py-6 flex items-center justify-between hover:bg-[#ebebe5] transition-colors"
                              >
                                <span className="font-sans font-bold uppercase tracking-widest text-sm text-[#5A5A40]">
                                  {part.title}
                                </span>
                                <motion.div
                                  animate={{ rotate: expandedPart === part.id ? 180 : 0 }}
                                >
                                  <ChevronDown size={20} />
                                </motion.div>
                              </button>
                              
                              <AnimatePresence>
                                {expandedPart === part.id && (
                                  <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                  >
                                    <div className="px-8 pb-8 pt-2 space-y-4">
                                      {part.content.map((text, idx) => (
                                        <p key={idx} className="text-lg text-[#4a4a4a] leading-relaxed">
                                          {text}
                                        </p>
                                      ))}
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </div>
          </section>

      {/* Project Info */}
      <section className="py-24 px-6 max-w-7xl mx-auto">
        <div className="grid md:grid-cols-2 gap-16 items-center">
          <div>
            <h3 className="text-4xl font-bold mb-8">El Proyecto</h3>
            <p className="text-lg text-[#4a4a4a] mb-6 leading-relaxed">
              Este proyecto invita a los alumnos a sumergirse en la riqueza culinaria de la Región de Murcia. El objetivo es diseñar una <strong>Carta Gastronómica Sostenible</strong> para un restaurante ficticio, arraigado en una de nuestras diez zonas geográficas.
            </p>
            <div className="space-y-4">
              {[
                "Equipos de máximo 5 personas",
                "Trabajo por hitos y entregas periódicas",
                "Foco en productos de proximidad y temporada",
                "Respeto por la tradición y la biodiversidad local"
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3">
                  <CheckCircle2 className="text-[#5A5A40]" size={20} />
                  <span className="text-lg">{item}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <img src="https://picsum.photos/seed/food1/400/500" alt="Plato típico" className="rounded-[2rem] shadow-lg" referrerPolicy="no-referrer" />
            <img src="https://picsum.photos/seed/food2/400/500" alt="Ingredientes" className="rounded-[2rem] shadow-lg mt-8" referrerPolicy="no-referrer" />
          </div>
        </div>
      </section>

      {/* Zones Grid */}
      <section className="py-24 bg-white px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h3 className="text-5xl font-bold mb-4">El Mapa del Sabor</h3>
            <p className="text-xl text-[#4a4a4a]">Selecciona una zona para descubrir su esencia gastronómica.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {zones.map((zone) => (
              <motion.div
                key={zone.id}
                whileHover={{ y: -10 }}
                className="group cursor-pointer bg-[#f5f5f0] rounded-[2.5rem] overflow-hidden shadow-sm hover:shadow-2xl transition-all"
                onClick={() => setSelectedZone(zone)}
              >
                <div className="h-64 overflow-hidden relative">
                  <img 
                    src={zone.image} 
                    alt={zone.name} 
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-sm px-4 py-1 rounded-full text-xs font-sans font-bold uppercase tracking-wider">
                    {zone.towns[0]}...
                  </div>
                </div>
                <div className="p-8">
                  <h4 className="text-2xl font-bold mb-2">{zone.name}</h4>
                  <p className="text-[#4a4a4a] mb-6 line-clamp-2">{zone.description}</p>
                  <div className="flex items-center text-[#5A5A40] font-sans font-bold text-sm uppercase tracking-widest group-hover:gap-4 transition-all">
                    Ver Detalles <ChevronRight size={16} />
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Zone Modal */}
      <AnimatePresence>
        {selectedZone && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedZone(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-[3rem] shadow-2xl"
            >
              <button 
                onClick={() => setSelectedZone(null)}
                className="absolute top-6 right-6 z-10 bg-white/80 backdrop-blur-sm p-2 rounded-full hover:bg-white transition-colors"
              >
                <X size={24} />
              </button>

              <div className="grid md:grid-cols-2">
                <div className="h-64 md:h-full">
                  <img 
                    src={selectedZone.image} 
                    alt={selectedZone.name} 
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <div className="p-8 md:p-12">
                  <div className="flex items-center gap-2 text-[#5A5A40] mb-4">
                    <MapPin size={18} />
                    <span className="font-sans font-bold uppercase tracking-widest text-sm">
                      {selectedZone.towns.join(', ')}
                    </span>
                  </div>
                  <h3 className="text-4xl font-bold mb-6">{selectedZone.name}</h3>
                  <p className="text-lg text-[#4a4a4a] mb-8 leading-relaxed">
                    {selectedZone.description}
                  </p>
                  
                  <div className="mb-8">
                    <h5 className="font-sans font-bold uppercase tracking-widest text-xs text-[#5A5A40] mb-4">Ingredientes Clave</h5>
                    <div className="flex flex-wrap gap-2">
                      {selectedZone.keyIngredients.map((ing, i) => (
                        <span key={i} className="bg-[#f5f5f0] px-4 py-2 rounded-full text-sm font-medium">
                          {ing}
                        </span>
                      ))}
                    </div>
                  </div>

                  <button 
                    onClick={() => createProject(selectedZone)}
                    className="w-full bg-[#5A5A40] text-white py-4 rounded-2xl font-sans font-bold hover:bg-[#4a4a35] transition-all flex items-center justify-center gap-2"
                  >
                    <UtensilsCrossed size={20} />
                    Elegir esta Zona para mi Proyecto
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Create Project Modal */}
      <AnimatePresence>
        {isCreatingProject && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCreatingProject(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="relative bg-white w-full max-w-md p-10 rounded-[3rem] shadow-2xl"
            >
              <h4 className="text-3xl font-bold mb-2">Nuevo Proyecto</h4>
              <p className="text-[#5A5A40] font-sans font-bold uppercase tracking-widest text-xs mb-8">
                Zona: {selectedZone?.name}
              </p>
              
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-sans font-bold uppercase tracking-widest text-gray-500 mb-2">
                    Nombre del Equipo
                  </label>
                  <input 
                    type="text" 
                    value={teamName}
                    onChange={(e) => setTeamName(e.target.value)}
                    placeholder="Ej: Los Chefs del Segura"
                    className="w-full px-6 py-4 bg-[#f5f5f0] rounded-2xl border-none focus:ring-2 focus:ring-[#5A5A40] transition-all outline-none"
                  />
                </div>
                
                <button 
                  onClick={confirmCreateProject}
                  disabled={!teamName.trim()}
                  className="w-full bg-[#5A5A40] text-white py-4 rounded-2xl font-sans font-bold hover:bg-[#4a4a35] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <Plus size={20} />
                  Crear Proyecto
                </button>
                
                <button 
                  onClick={() => setIsCreatingProject(false)}
                  className="w-full text-gray-500 font-sans font-bold uppercase tracking-widest text-xs hover:text-black transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Methodology Section */}
      <section className="py-24 bg-[#5A5A40] text-white px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h3 className="text-5xl font-bold mb-4">Metodología de Trabajo</h3>
            <p className="text-xl text-gray-300">Un proceso estructurado para alcanzar la excelencia gastronómica.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-12">
            {[
              {
                title: "1. Formación de Equipos",
                desc: "Grupos de máximo 5 personas. La diversidad de talentos es clave para una carta equilibrada.",
                icon: <Users size={32} />
              },
              {
                title: "2. Investigación de Zona",
                desc: "Cada equipo elige una de las 10 demarcaciones regionales para estudiar su despensa natural.",
                icon: <MapPin size={32} />
              },
              {
                title: "3. Hitos y Entregas",
                desc: "Trabajo dinámico con entregas periódicas programadas para asegurar el progreso constante.",
                icon: <CheckCircle2 size={32} />
              }
            ].map((step, i) => (
              <div key={i} className="bg-white/10 backdrop-blur-sm p-10 rounded-[3rem] border border-white/10">
                <div className="mb-6 text-[#f5f5f0]">{step.icon}</div>
                <h4 className="text-2xl font-bold mb-4">{step.title}</h4>
                <p className="text-gray-300 leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
        </>
      )}

      {/* Footer */}
      <footer className="bg-[#1a1a1a] text-white py-20 px-6">
        <div className="max-w-7xl mx-auto grid md:grid-cols-3 gap-12">
          <div>
            <div className="flex items-center gap-2 mb-6">
              <Leaf className="text-[#5A5A40]" size={24} />
              <h4 className="text-xl font-bold tracking-tight">Sabores de Nuestra Tierra</h4>
            </div>
            <p className="text-gray-400 leading-relaxed">
              Fomentando la educación gastronómica sostenible y el respeto por el producto local en la Región de Murcia.
            </p>
          </div>
          <div>
            <h5 className="font-sans font-bold uppercase tracking-widest text-xs text-gray-500 mb-6">Enlaces</h5>
            <div className="flex flex-col gap-4 text-gray-300">
              <button className="text-left hover:text-white transition-colors">Guía del Alumno</button>
              <button className="text-left hover:text-white transition-colors">Recursos Sostenibles</button>
              <button className="text-left hover:text-white transition-colors">Contacto</button>
            </div>
          </div>
          <div>
            <h5 className="font-sans font-bold uppercase tracking-widest text-xs text-gray-500 mb-6">Metodología</h5>
            <p className="text-gray-400 mb-6">
              Basado en el aprendizaje por proyectos (ABP) y la economía circular.
            </p>
            <div className="flex gap-4">
              <div className="w-10 h-10 rounded-full border border-gray-700 flex items-center justify-center hover:border-white transition-colors cursor-pointer">
                <Info size={18} />
              </div>
              <div className="w-10 h-10 rounded-full border border-gray-700 flex items-center justify-center hover:border-white transition-colors cursor-pointer">
                <Users size={18} />
              </div>
            </div>
          </div>
        </div>
        <div className="max-w-7xl mx-auto mt-20 pt-8 border-top border-gray-800 text-center text-gray-500 text-sm">
          © 2026 Sabores de Nuestra Tierra - Región de Murcia
        </div>
      </footer>
    </div>
  );
}
