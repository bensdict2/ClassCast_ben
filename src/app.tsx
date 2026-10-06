import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInAnonymously, 
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  GoogleAuthProvider,
  signInWithPopup
} from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  setDoc, 
  onSnapshot, 
  collection,
  addDoc,
  deleteDoc,
  getDoc
} from 'firebase/firestore';

const appId = 'my-classroom-app'; 

const API_KEY_PART_1 = "AIzaSyAUgrP14-";
const API_KEY_PART_2 = "UcSZe-cn4kstkIVW5CfIhOkXA";

const firebaseConfig = {
  apiKey: API_KEY_PART_1 + API_KEY_PART_2,
  authDomain: "classcast-39a37.firebaseapp.com",
  projectId: "classcast-39a37",
  storageBucket: "classcast-39a37.firebasestorage.app",
  messagingSenderId: "740494439681",
  appId: "1:740494439681:web:2ed5ba475d0ea1fe575700",
  measurementId: "G-B0YFXBL8W9"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const loadPeerJS = () => {
  return new Promise((resolve, reject) => {
    if (window.Peer) {
      resolve(window.Peer);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/peerjs@1.5.2/dist/peerjs.min.js';
    script.onload = () => resolve(window.Peer);
    script.onerror = () => reject(new Error('Failed to load PeerJS'));
    document.head.appendChild(script);
  });
};

const generateRoomCode = () => {
  return Math.floor(10000 + Math.random() * 90000).toString(); 
};

const parseMediaUrl = (url, page = 1) => {
    if (!url) return null;
    if (url.includes('docs.google.com/presentation')) {
        const match = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
        if (match && match[1]) {
            const embedUrl = `https://docs.google.com/presentation/d/${match[1]}/embed?rm=minimal&slide=${page}`;
            return { type: 'iframe', src: embedUrl };
        }
    }
    if (url.includes('youtube.com/watch') || url.includes('youtu.be/')) {
        let videoId = '';
        if (url.includes('youtube.com/watch')) {
            videoId = new URL(url).searchParams.get('v');
        } else {
            videoId = url.split('youtu.be/')[1].split('?')[0];
        }
        return { type: 'iframe', src: `https://www.youtube.com/embed/${videoId}?autoplay=1` };
    }
    return { type: 'image', src: url };
};

export default function App() {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null); 
  const [roomCode, setRoomCode] = useState('');
  const [studentName, setStudentName] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isPeerLoaded, setIsPeerLoaded] = useState(false);

  // Teacher Auth State
  const [showTeacherAuth, setShowTeacherAuth] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  const urlParams = new URLSearchParams(window.location.search);
  const isProjector = urlParams.get('projector') === 'true';
  const projCode = urlParams.get('code');

  useEffect(() => {
    const authenticate = async () => {
      try {
        if (!auth.currentUser) {
            await signInAnonymously(auth);
        }
      } catch (error) {
        console.error("Auth Error:", error);
        setErrorMsg("Failed to connect to authentication server.");
      }
    };
    authenticate();

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    
    if (window.location.hash === '#teacher') {
        setShowTeacherAuth(true);
    }

    loadPeerJS().then(() => setIsPeerLoaded(true)).catch(err => console.error(err));

    return () => unsubscribe();
  }, []);

  const handleTeacherAuthSubmit = async (e) => {
      e.preventDefault();
      setErrorMsg('');
      setAuthLoading(true);

      try {
          if (isSignUp) {
              await createUserWithEmailAndPassword(auth, email, password);
          } else {
              await signInWithEmailAndPassword(auth, email, password);
          }
          setRoomCode(generateRoomCode());
          setRole('teacher');
      } catch (error) {
          if (error.code === 'auth/email-already-in-use') setErrorMsg('This email is already registered. Please log in.');
          else if (error.code === 'auth/wrong-password') setErrorMsg('Incorrect password.');
          else if (error.code === 'auth/user-not-found') setErrorMsg('No account found with this email.');
          else if (error.code === 'auth/weak-password') setErrorMsg('Password must be at least 6 characters.');
          else setErrorMsg(error.message);
      } finally {
          setAuthLoading(false);
      }
  };

  const handleGoogleSignIn = async () => {
      setErrorMsg('');
      setAuthLoading(true);
      const provider = new GoogleAuthProvider();
      try {
          await signInWithPopup(auth, provider);
          setRoomCode(generateRoomCode());
          setRole('teacher');
      } catch (error) {
          setErrorMsg(error.message);
      } finally {
          setAuthLoading(false);
      }
  };

  if (!user || !isPeerLoaded) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">
        <div className="animate-pulse text-xl font-semibold text-emerald-400">Loading Classroom Environment...</div>
      </div>
    );
  }

  if (isProjector && projCode) {
      return <ProjectorView roomCode={projCode} />;
  }

  if (!role) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col items-center justify-center p-4 font-sans">
        <div className="max-w-md w-full bg-slate-800 p-8 rounded-2xl shadow-2xl border border-slate-700 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-400 to-blue-500"></div>
          
          <div className="text-center mb-8">
              <h1 className="text-4xl font-extrabold mb-2 text-white flex items-center justify-center gap-3">
                 <svg className="w-8 h-8 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
                 ClassCast
              </h1>
              <p className="text-slate-400 text-sm">Interactive Cloud Presentation</p>
          </div>
          
          {errorMsg && (
            <div className="bg-red-900/50 border border-red-500 text-red-200 p-3 rounded-lg mb-6 text-sm text-center">
              {errorMsg}
            </div>
          )}

          {!showTeacherAuth ? (
              <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
                <input 
                  type="text" 
                  placeholder="Student Name" 
                  value={studentName}
                  onChange={(e) => setStudentName(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-white placeholder-slate-400"
                />
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    placeholder="5-Digit Code" 
                    value={roomCode}
                    onChange={(e) => setRoomCode(e.target.value.toUpperCase().trim().slice(0, 5))}
                    className="w-2/3 px-4 py-3 bg-slate-700 border border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-white text-center text-lg tracking-widest placeholder-slate-400 font-mono"
                  />
                  <button 
                    onClick={() => {
                      if (roomCode.length === 5 && studentName.trim()) setRole('student');
                      else setErrorMsg('Please enter your name and a 5-digit code.');
                    }}
                    className="w-1/3 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold transition-all shadow-lg hover:shadow-emerald-500/25 active:scale-95"
                  >
                    Join
                  </button>
                </div>
                
                <div className="mt-8 pt-6 border-t border-slate-700 text-center">
                   
                </div>
              </div>
          ) : (
              <form onSubmit={handleTeacherAuthSubmit} className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
                <div className="text-center mb-4">
                    <h2 className="text-xl font-bold text-white">{isSignUp ? 'Create Teacher Account' : 'Teacher Login'}</h2>
                    <p className="text-xs text-slate-400 mt-1">Your questions will be securely saved to your account.</p>
                </div>
                
                <input 
                  type="email" 
                  placeholder="Email Address" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-white placeholder-slate-400"
                />
                <input 
                  type="password" 
                  placeholder="Password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-white placeholder-slate-400"
                />
                
                <button 
                  type="submit"
                  disabled={authLoading}
                  className="w-full py-3 mt-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:text-slate-400 text-white rounded-xl font-bold transition-all shadow-lg hover:shadow-blue-500/25 active:scale-95 flex justify-center items-center gap-2"
                >
                  {authLoading ? 'Please wait...' : isSignUp ? 'Create Account & Start' : 'Log In & Start Class'}
                </button>

                <div className="relative flex items-center py-2">
                    <div className="flex-grow border-t border-slate-600"></div>
                    <span className="flex-shrink-0 mx-4 text-slate-400 text-xs uppercase tracking-wider">Or</span>
                    <div className="flex-grow border-t border-slate-600"></div>
                </div>

                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={authLoading}
                  className="w-full py-3 bg-white text-slate-800 hover:bg-slate-100 disabled:bg-slate-300 rounded-xl font-bold transition-all shadow-lg active:scale-95 flex justify-center items-center gap-3"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                  Sign in with Google
                </button>

                <div className="flex flex-col items-center gap-4 mt-4 pt-4 border-t border-slate-700">
                    <button
                      type="button"
                      onClick={() => setIsSignUp(!isSignUp)}
                      className="text-slate-400 hover:text-white text-sm transition-colors mt-2"
                    >
                      {isSignUp ? 'Already have an account? Log in' : 'Need an account? Sign up'}
                    </button>
                    <button 
                        type="button"
                        onClick={() => setShowTeacherAuth(false)}
                        className="text-slate-500 hover:text-slate-400 text-sm transition-colors mt-2"
                    >
                        &larr; Back to Student Join
                    </button>
                </div>
              </form>
          )}
        </div>
      </div>
    );
  }

  return role === 'teacher' ? (
    <TeacherView user={user} roomCode={roomCode} />
  ) : (
    <StudentView user={user} roomCode={roomCode} studentName={studentName} />
  );
}

// Word Cloud Helper function
const getWordCloudData = (answers) => {
    const counts = {};
    answers.forEach(a => {
        const word = String(a.selectedOption || '').trim().toUpperCase();
        if (word) counts[word] = (counts[word] || 0) + 1;
    });
    return Object.entries(counts).sort((a,b) => b[1] - a[1]); 
};

// Beautiful colors for the word cloud
const wordCloudColors = ['text-emerald-400', 'text-blue-400', 'text-orange-400', 'text-pink-400', 'text-purple-400', 'text-yellow-400'];


function TeacherView({ user, roomCode }) {
  const [slideUrl, setSlideUrl] = useState('');
  const [activeSlide, setActiveSlide] = useState(null);
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  
  const videoRef = useRef(null);
  const localStreamRef = useRef(null);
  const peerRef = useRef(null);
  
  const [activeQuestion, setActiveQuestion] = useState(null);
  const [answers, setAnswers] = useState([]);
  const [errorMsg, setErrorMsg] = useState('');
  
  const [questionBank, setQuestionBank] = useState([]);
  const [qType, setQType] = useState('mcq');
  const [qText, setQText] = useState('');
  const [qOptions, setQOptions] = useState(['', '']);

  const openProjector = () => {
     window.open(`/?projector=true&code=${roomCode}`, 'ClassCastProjector', 'width=1280,height=720');
  };

  const handleLogout = async () => {
      await signOut(auth);
      window.location.reload(); 
  };

  useEffect(() => {
    if (!user) return;
    const bankRef = collection(db, 'artifacts', appId, 'users', user.uid, 'questionBank');
    const unsubscribeBank = onSnapshot(bankRef, (snapshot) => {
       const qs = [];
       snapshot.forEach(doc => qs.push({ id: doc.id, ...doc.data() }));
       qs.sort((a, b) => a.timestamp - b.timestamp);
       setQuestionBank(qs);
    });

    let unsubscribeAnswers = () => {};
    if (activeQuestion) {
      const answersRef = collection(db, 'artifacts', appId, 'public', 'data', 'sessions', roomCode, 'answers');
      unsubscribeAnswers = onSnapshot(answersRef, (snapshot) => {
        const results = [];
        snapshot.forEach(doc => results.push(doc.data()));
        setAnswers(results);
      }, (error) => console.error("Error fetching answers:", error));
    }
    
    return () => {
        unsubscribeBank();
        unsubscribeAnswers();
    };
  }, [activeQuestion, roomCode, user]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
      if (!activeSlide || activeSlide.type === 'screen') return;

      if (['ArrowRight', 'PageDown', ' '].includes(e.key)) {
        e.preventDefault(); 
        changePage(1);
      } else if (['ArrowLeft', 'PageUp'].includes(e.key)) {
        e.preventDefault();
        changePage(-1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeSlide, roomCode]);

  const pushSlide = async () => {
    if (!slideUrl) return;
    if (isBroadcasting) stopBroadcast(); 
    
    try {
      const sessionRef = doc(db, 'artifacts', appId, 'public', 'data', 'sessions', roomCode);
      const slideData = { type: 'link', url: slideUrl, page: 1, timestamp: Date.now() };
      await setDoc(sessionRef, { activeSlide: slideData }, { merge: true });
      setActiveSlide(slideData);
      setSlideUrl(''); 
      setErrorMsg('');
    } catch (err) {
      setErrorMsg("Failed to push slide.");
    }
  };

  const changePage = async (delta) => {
    if (!activeSlide || activeSlide.type === 'screen') return;
    const newPage = Math.max(1, (activeSlide.page || 1) + delta);
    try {
      const sessionRef = doc(db, 'artifacts', appId, 'public', 'data', 'sessions', roomCode);
      const slideData = { ...activeSlide, page: newPage, timestamp: Date.now() };
      await setDoc(sessionRef, { activeSlide: slideData }, { merge: true });
      setActiveSlide(slideData);
    } catch (err) {
      console.error("Failed to change page:", err);
    }
  };

  const clearSlide = async () => {
    if (isBroadcasting) stopBroadcast();
    try {
      const sessionRef = doc(db, 'artifacts', appId, 'public', 'data', 'sessions', roomCode);
      await setDoc(sessionRef, { activeSlide: null }, { merge: true });
      setActiveSlide(null);
    } catch (err) {}
  };

  const startBroadcast = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { width: { max: 1280 }, height: { max: 720 }, frameRate: { max: 15 } },
        audio: false
      });

      localStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setIsBroadcasting(true);
      setErrorMsg('');

      stream.getVideoTracks()[0].onended = () => {
        stopBroadcast();
      };

      const peer = new window.Peer(`classcast-${appId}-${roomCode}-host`);
      peerRef.current = peer;

      peer.on('connection', (conn) => {
        conn.on('data', async (data) => {
          if (data.type === 'request-stream') {
             const call = peer.call(conn.peer, localStreamRef.current);
             try {
                const sender = call.peerConnection.getSenders().find(s => s.track && s.track.kind === 'video');
                if (sender) {
                  const parameters = sender.getParameters();
                  if (!parameters.encodings) parameters.encodings = [{}];
                  parameters.encodings[0].maxBitrate = 400 * 1000; 
                  await sender.setParameters(parameters);
                }
             } catch (err) { console.warn(err); }
          }
        });
      });

      const sessionRef = doc(db, 'artifacts', appId, 'public', 'data', 'sessions', roomCode);
      const slideData = { type: 'screen', timestamp: Date.now() };
      await setDoc(sessionRef, { activeSlide: slideData }, { merge: true });
      setActiveSlide(slideData);

    } catch (err) {
      setErrorMsg("Failed to start screen share. Permissions denied.");
    }
  };

  const stopBroadcast = async () => {
    if (localStreamRef.current) localStreamRef.current.getTracks().forEach(track => track.stop());
    if (peerRef.current) peerRef.current.destroy();
    setIsBroadcasting(false);
    
    try {
      const sessionRef = doc(db, 'artifacts', appId, 'public', 'data', 'sessions', roomCode);
      await setDoc(sessionRef, { activeSlide: null }, { merge: true });
      setActiveSlide(null);
    } catch (err) {}
  };

  useEffect(() => {
    return () => { if (isBroadcasting) stopBroadcast(); };
  }, []);

  const updateOption = (index, value) => {
      const newOptions = [...qOptions];
      newOptions[index] = value;
      setQOptions(newOptions);
  };
  const addOption = () => setQOptions([...qOptions, '']);
  const removeOption = (index) => setQOptions(qOptions.filter((_, i) => i !== index));

  const saveToBank = async () => {
      if (!qText.trim()) {
          setErrorMsg("Question text cannot be empty."); return;
      }
      const newQuestion = {
          type: qType,
          text: qText,
          options: (qType === 'mcq' || qType === 'rank') ? qOptions.filter(o => o.trim()) : [],
          timestamp: Date.now()
      };
      
      try {
          const bankRef = collection(db, 'artifacts', appId, 'users', user.uid, 'questionBank');
          await addDoc(bankRef, newQuestion);
          setQText(''); setQOptions(['', '']); setErrorMsg('');
      } catch (err) { setErrorMsg("Failed to save to bank."); }
  };

  const deleteFromBank = async (qId) => {
      try {
          const qRef = doc(db, 'artifacts', appId, 'users', user.uid, 'questionBank', qId);
          await deleteDoc(qRef);
      } catch (err) { console.error("Failed to delete", err); }
  };

  const launchQuestion = async (questionObj) => {
    try {
      const sessionRef = doc(db, 'artifacts', appId, 'public', 'data', 'sessions', roomCode);
      await setDoc(sessionRef, { activeQuestion: questionObj }, { merge: true });
      setActiveQuestion(questionObj);
      setAnswers([]); 
    } catch (err) { setErrorMsg("Failed to send question to class."); }
  };

  const clearQuestion = async () => {
    try {
      const sessionRef = doc(db, 'artifacts', appId, 'public', 'data', 'sessions', roomCode);
      await setDoc(sessionRef, { activeQuestion: null }, { merge: true });
      setActiveQuestion(null);
    } catch (err) {}
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white p-6 flex flex-col md:flex-row gap-6 font-sans">
      
      <div className="flex-1 flex flex-col gap-6">
        <div className="bg-slate-800 rounded-2xl p-6 shadow-xl border border-slate-700 flex justify-between items-center relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>
          <div>
            <h2 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
               Teacher Dashboard
               <span className="text-xs bg-slate-700 text-slate-300 px-2 py-1 rounded-full border border-slate-600 font-normal">
                   Logged in securely
               </span>
            </h2>
            <p className="text-slate-400">Class Code: <span className="text-emerald-400 font-mono text-2xl font-bold tracking-widest ml-2 bg-slate-900 px-3 py-1 rounded-lg border border-slate-700">{roomCode}</span></p>
          </div>
          <div className="flex gap-3">
              <button 
                 onClick={openProjector} 
                 className="px-6 py-3 bg-purple-600 hover:bg-purple-500 rounded-xl font-bold transition-all shadow-lg flex items-center gap-2 active:scale-95"
              >
                 <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
                 Launch Projector
              </button>
              <button 
                 onClick={handleLogout} 
                 className="px-4 py-3 bg-slate-700 hover:bg-red-600 rounded-xl font-bold transition-all shadow-lg border border-slate-600 hover:border-red-500 active:scale-95"
              >
                 Log Out
              </button>
          </div>
        </div>

        {errorMsg && (
          <div className="bg-red-900/50 border border-red-500 text-red-200 p-4 rounded-xl shadow-lg">
            {errorMsg}
          </div>
        )}

        <div className="bg-slate-800 rounded-2xl p-6 shadow-xl border border-slate-700 flex flex-col gap-4 flex-1">
           <h3 className="text-xl font-bold text-slate-100 border-b border-slate-700 pb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                 <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                 Cloud Presentation Sync
              </div>
           </h3>
           
           <div className="flex gap-3">
              <input 
                 type="text" 
                 placeholder="Paste Google Slides or Image Link..." 
                 value={slideUrl}
                 onChange={(e) => setSlideUrl(e.target.value)}
                 className="flex-1 bg-slate-900 border border-slate-600 rounded-xl p-4 text-white focus:outline-none focus:border-emerald-500 font-mono text-sm"
              />
              <button 
                 onClick={pushSlide}
                 className="px-6 py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold transition-all shadow-lg active:scale-95 whitespace-nowrap"
              >
                 Sync Link
              </button>
              <div className="border-l border-slate-600 mx-2"></div>
              {!isBroadcasting ? (
                 <button 
                    onClick={startBroadcast}
                    className="px-6 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold transition-all shadow-lg active:scale-95 whitespace-nowrap flex items-center gap-2"
                 >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
                    Share Screen
                 </button>
              ) : (
                 <button 
                    onClick={stopBroadcast}
                    className="px-6 py-4 bg-red-600 hover:bg-red-500 text-white rounded-xl font-bold transition-all shadow-lg active:scale-95 whitespace-nowrap animate-pulse"
                 >
                    Stop Sharing
                 </button>
              )}
           </div>

           <div className="flex-1 bg-black rounded-xl overflow-hidden border border-slate-700 relative flex items-center justify-center min-h-[350px]">
              {activeSlide ? (
                 <>
                    <div className="absolute top-2 left-2 bg-black/60 px-3 py-1 rounded-md text-xs font-mono z-20 flex gap-2 shadow-lg backdrop-blur-sm border border-slate-600">
                       <span className="text-emerald-400 flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div> Live on student screens</span>
                       <button onClick={clearSlide} className="text-red-400 hover:text-red-300 ml-2 underline border-l border-slate-600 pl-4">Clear Screen</button>
                    </div>
                    
                    {activeSlide.type === 'screen' ? (
                       <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-contain" />
                    ) : parseMediaUrl(activeSlide.url, activeSlide.page)?.type === 'iframe' ? (
                       <div className="w-full h-full flex flex-col relative">
                          <iframe 
                            src={parseMediaUrl(activeSlide.url, activeSlide.page).src} 
                            className="w-full flex-1 border-0 bg-white" 
                            allowFullScreen
                          />
                          {activeSlide.url.includes('docs.google.com/presentation') && (
                              <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-slate-900/95 p-3 rounded-2xl border-2 border-slate-600 flex items-center gap-6 z-30 shadow-2xl backdrop-blur-md">
                                 <button onClick={() => changePage(-1)} className="px-5 py-2 bg-slate-700 hover:bg-slate-600 rounded-xl text-white font-bold transition-all shadow-md active:scale-95">&larr; Prev</button>
                                 <span className="text-emerald-400 font-bold whitespace-nowrap text-lg">Slide {activeSlide.page || 1}</span>
                                 <button onClick={() => changePage(1)} className="px-5 py-2 bg-slate-700 hover:bg-slate-600 rounded-xl text-white font-bold transition-all shadow-md active:scale-95">Next &rarr;</button>
                              </div>
                          )}
                       </div>
                    ) : (
                       <img src={parseMediaUrl(activeSlide.url, activeSlide.page).src} className="w-full h-full object-contain" alt="Preview" />
                    )}
                 </>
              ) : (
                 <div className="text-center text-slate-500">
                    <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
                    <p>Paste a link or share your screen above.</p>
                 </div>
              )}
           </div>
        </div>
      </div>

      <div className="w-full md:w-[450px] flex flex-col gap-6">
        {activeQuestion && (
           <div className="bg-slate-800 rounded-2xl p-6 shadow-xl border-2 border-orange-500 relative overflow-hidden animate-in fade-in flex flex-col min-h-[300px]">
              <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-orange-400 to-pink-500"></div>
              <div className="flex justify-between items-center mb-4">
                 <h3 className="text-xl font-bold text-orange-400 flex items-center gap-2">
                   <div className="w-3 h-3 bg-orange-500 rounded-full animate-pulse"></div> Live Session
                 </h3>
                 <button onClick={clearQuestion} className="text-sm bg-slate-700 hover:bg-slate-600 px-3 py-1 rounded text-white border border-slate-600">Close Question</button>
              </div>
              <p className="font-semibold text-white text-lg mb-4">{activeQuestion.text}</p>
              
              <div className="bg-slate-900 rounded-xl p-4 border border-slate-700 flex-1 overflow-y-auto">
                 {answers.length === 0 ? (
                    <p className="text-slate-500 text-center italic text-sm mt-8">Waiting for student responses...</p>
                 ) : activeQuestion.type === 'word_cloud' ? (
                     <div className="flex flex-wrap justify-center items-center gap-4 py-4 min-h-[150px]">
                         {getWordCloudData(answers).map(([word, count], i) => (
                             <span 
                                key={word} 
                                style={{ 
                                   fontSize: `${Math.min(1 + (count - 1) * 0.3, 3.5)}rem`,
                                   opacity: Math.min(0.6 + count * 0.2, 1)
                                }} 
                                className={`font-black tracking-tight transition-all drop-shadow-md ${wordCloudColors[i % wordCloudColors.length]}`}
                             >
                                {word}
                             </span>
                         ))}
                     </div>
                 ) : (
                    <div className="space-y-2">
                       {answers.map((ans, idx) => (
                         <div key={idx} className="bg-slate-800 p-3 rounded-lg border border-slate-700 flex flex-col gap-1">
                           <span className="font-medium text-slate-300 text-sm">{ans.studentName}</span>
                           <span className="text-white font-bold bg-blue-500/20 px-3 py-1.5 rounded inline-block border border-blue-500/30 break-words">
                             {Array.isArray(ans.selectedOption) ? ans.selectedOption.join(' ➔ ') : ans.selectedOption}
                           </span>
                         </div>
                       ))}
                    </div>
                 )}
              </div>
           </div>
        )}

        {!activeQuestion && (
           <div className="bg-slate-800 rounded-2xl shadow-xl border border-slate-700 flex flex-col flex-1 overflow-hidden">
              <div className="p-6 border-b border-slate-700 bg-slate-800/50">
                 <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                    <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path></svg>
                    Question Builder
                 </h3>
                 <div className="space-y-4">
                    <select 
                       value={qType} 
                       onChange={(e) => setQType(e.target.value)}
                       className="w-full bg-slate-900 border border-slate-600 rounded-xl p-3 text-white focus:outline-none focus:border-blue-500 appearance-none font-medium"
                    >
                       <option value="mcq">🔵 Multiple Choice</option>
                       <option value="short_answer">📝 Short Answer</option>
                       <option value="word_cloud">☁️ Word Cloud</option>
                       <option value="thumbs">👍 Thumbs Up / Down</option>
                       <option value="temperature">🌡️ Temperature Check (Emoji)</option>
                       <option value="rank">🔢 Rank / Order Items</option>
                    </select>

                    <textarea 
                      placeholder={qType === 'word_cloud' ? "e.g. 'In one word, describe today's lesson...'" : "Type your question here..."}
                      value={qText}
                      onChange={(e) => setQText(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-600 rounded-xl p-3 text-white focus:outline-none focus:border-blue-500 h-20 resize-none"
                    />

                    {(qType === 'mcq' || qType === 'rank') && (
                       <div className="space-y-2">
                          {qOptions.map((opt, i) => (
                             <div key={i} className="flex gap-2">
                                <input 
                                   type="text" 
                                   placeholder={`Option ${i + 1}`}
                                   value={opt}
                                   onChange={(e) => updateOption(i, e.target.value)}
                                   className="flex-1 bg-slate-900 border border-slate-600 rounded-lg p-2 text-white focus:outline-none focus:border-blue-500 text-sm"
                                />
                                {qOptions.length > 2 && (
                                   <button onClick={() => removeOption(i)} className="p-2 bg-red-900/50 text-red-400 hover:bg-red-500 hover:text-white rounded-lg border border-red-500/30 transition-colors">✕</button>
                                )}
                             </div>
                          ))}
                          <button onClick={addOption} className="text-sm text-blue-400 hover:text-blue-300 font-medium">+ Add Option</button>
                       </div>
                    )}

                    <button 
                      onClick={saveToBank}
                      className="w-full py-3 bg-blue-600 hover:bg-blue-500 rounded-xl font-bold transition-all shadow-lg text-white active:scale-95 flex items-center justify-center gap-2"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"></path></svg>
                      Save to Private Bank
                    </button>
                 </div>
              </div>

              <div className="flex-1 p-6 overflow-y-auto bg-slate-900/50">
                 <div className="flex justify-between items-center mb-4">
                     <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider">My Saved Questions ({questionBank.length})</h4>
                     <span className="text-[10px] bg-emerald-900/50 text-emerald-400 px-2 py-1 rounded-full border border-emerald-800">Auto-synced securely</span>
                 </div>
                 
                 <div className="space-y-3">
                    {questionBank.length === 0 ? (
                       <p className="text-slate-500 text-sm italic text-center mt-6">Questions saved here will permanently sync to your account.</p>
                    ) : (
                       questionBank.map((q) => (
                          <div key={q.id} className="bg-slate-800 p-4 rounded-xl border border-slate-600 shadow-sm flex flex-col gap-3 group hover:border-slate-500 transition-colors">
                             <div className="flex justify-between items-start gap-2">
                                <span className="font-medium text-white text-sm leading-snug">{q.text}</span>
                                <span className="text-xs px-2 py-1 bg-slate-700 rounded text-slate-300 whitespace-nowrap">
                                   {q.type === 'mcq' && 'MCQ'}
                                   {q.type === 'short_answer' && 'Short Ans'}
                                   {q.type === 'word_cloud' && 'Word Cloud'}
                                   {q.type === 'thumbs' && 'Thumbs'}
                                   {q.type === 'temperature' && 'Temp'}
                                   {q.type === 'rank' && 'Rank'}
                                </span>
                             </div>
                             <div className="flex gap-2 mt-1">
                                <button 
                                   onClick={() => launchQuestion(q)}
                                   className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-2 rounded-lg font-bold text-sm transition-colors shadow-md active:scale-95 flex items-center justify-center gap-1"
                                >
                                   <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                                   Launch Live
                                </button>
                                <button 
                                   onClick={() => deleteFromBank(q.id)}
                                   className="px-3 bg-slate-700 hover:bg-red-600 text-slate-300 hover:text-white rounded-lg transition-colors border border-slate-600"
                                >
                                   ✕
                                </button>
                             </div>
                          </div>
                       ))
                    )}
                 </div>
              </div>
           </div>
        )}
      </div>
    </div>
  );
}

function StudentView({ user, roomCode, studentName }) {
  const [activeSlide, setActiveSlide] = useState(null);
  const [activeQuestion, setActiveQuestion] = useState(null);
  const [hasAnswered, setHasAnswered] = useState(false);
  const questionIdRef = useRef(null);

  const [isPeerConnected, setIsPeerConnected] = useState(false);
  const videoRef = useRef(null);
  const peerRef = useRef(null);

  const [shortAnswerText, setShortAnswerText] = useState('');
  const [rankOrder, setRankOrder] = useState([]);

  useEffect(() => {
    const sessionRef = doc(db, 'artifacts', appId, 'public', 'data', 'sessions', roomCode);
    const unsubscribe = onSnapshot(sessionRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setActiveSlide(data.activeSlide || null);

        if (data.activeQuestion) {
          if (questionIdRef.current !== data.activeQuestion.id) {
            setHasAnswered(false);
            setShortAnswerText('');
            setRankOrder([]);
            questionIdRef.current = data.activeQuestion.id;
          }
          setActiveQuestion(data.activeQuestion);
        } else {
          setActiveQuestion(null);
          questionIdRef.current = null;
          setHasAnswered(false);
        }
      }
    });
    return () => unsubscribe();
  }, [roomCode]);

  useEffect(() => {
     if (activeSlide?.type === 'screen' && window.Peer && !isPeerConnected) {
         const peer = new window.Peer();
         peerRef.current = peer;
         const teacherId = `classcast-${appId}-${roomCode}-host`;

         peer.on('open', () => {
             const conn = peer.connect(teacherId);
             conn.on('open', () => {
                 setIsPeerConnected(true);
                 conn.send({ type: 'request-stream' });
             });
         });

         peer.on('call', (call) => {
             call.answer(); 
             call.on('stream', (stream) => {
                 if (videoRef.current) videoRef.current.srcObject = stream;
             });
         });

         return () => {
             peer.destroy();
             setIsPeerConnected(false);
         };
     }
  }, [activeSlide?.type, roomCode]); 

  const submitAnswer = async (payload) => {
    if (!activeQuestion || !user) return;
    setHasAnswered(true); 
    try {
      const answerRef = doc(db, 'artifacts', appId, 'public', 'data', 'sessions', roomCode, 'answers', user.uid);
      await setDoc(answerRef, {
        studentName: studentName,
        selectedOption: payload,
        questionId: activeQuestion.id,
        timestamp: Date.now()
      });
    } catch (err) {
      console.error("Failed to submit answer:", err);
      setHasAnswered(false);
    }
  };

  const handleRankClick = (opt) => {
      if (rankOrder.includes(opt)) {
          setRankOrder(rankOrder.filter(o => o !== opt));
      } else {
          setRankOrder([...rankOrder, opt]);
      }
  };

  return (
    <div className="fixed inset-0 w-full h-full bg-black flex flex-col font-sans overflow-hidden z-50">
      
      <div className="absolute top-0 left-0 w-full p-4 flex justify-between items-center z-40 bg-gradient-to-b from-black/90 via-black/60 to-transparent pointer-events-none">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center font-bold text-white shadow-lg border border-emerald-500/50">
            {studentName.charAt(0).toUpperCase()}
          </div>
          <span className="text-white font-medium text-lg drop-shadow-md">{studentName}</span>
        </div>
        <div className="flex items-center gap-2 bg-black/60 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 shadow-lg">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)] animate-pulse"></div>
          <span className="text-sm text-emerald-400 font-bold tracking-wider">
            ROOM {roomCode}
          </span>
        </div>
      </div>

      <div className="flex-1 w-full h-full flex flex-col md:flex-row relative z-0">
         
         <div className="flex-1 h-full relative bg-black flex items-center justify-center transition-all duration-500 overflow-hidden">
            {!activeSlide ? (
               <div className="flex flex-col items-center justify-center scale-110">
                  <svg className="w-24 h-24 text-slate-700 mb-6 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
                  <p className="text-slate-500 font-medium text-xl tracking-wide">Waiting for teacher's presentation...</p>
               </div>
            ) : (
               <div className="w-full h-full bg-black relative">
                  {activeSlide.type === 'screen' ? (
                     <>
                        {!isPeerConnected && (
                           <div className="absolute inset-0 flex flex-col items-center justify-center z-20 bg-black">
                              <div className="w-12 h-12 border-4 border-slate-700 border-t-emerald-500 rounded-full animate-spin mb-4"></div>
                              <p className="text-slate-400 font-medium">Connecting to Screen Share...</p>
                           </div>
                        )}
                        <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-contain pointer-events-none" />
                     </>
                  ) : (
                     <>
                        {parseMediaUrl(activeSlide.url, activeSlide.page)?.type === 'iframe' && (
                           <div className="absolute inset-0 z-10 w-full h-full cursor-not-allowed"></div>
                        )}
                        {parseMediaUrl(activeSlide.url, activeSlide.page)?.type === 'iframe' && (
                           <iframe 
                             src={parseMediaUrl(activeSlide.url, activeSlide.page).src} 
                             className="w-full h-full border-0 bg-black pointer-events-none" 
                             allowFullScreen
                           />
                        )}
                        {parseMediaUrl(activeSlide.url, activeSlide.page)?.type === 'image' && (
                           <img src={parseMediaUrl(activeSlide.url, activeSlide.page).src} className="w-full h-full object-contain" />
                        )}
                     </>
                  )}
               </div>
            )}
         </div>

         <div 
           className={`bg-slate-800 shadow-[-20px_0_40px_rgba(0,0,0,0.6)] flex flex-col transition-all duration-500 ease-in-out relative z-30 overflow-hidden
           ${activeQuestion ? 'h-[55%] md:h-full w-full md:w-[420px] border-t md:border-t-0 md:border-l border-orange-500/50' : 'h-0 md:h-full w-full md:w-0 border-none'}`}
         >
            <div className="w-full md:w-[420px] h-full overflow-y-auto relative p-6 pt-16 md:pt-24 flex flex-col">
               {activeQuestion && (
                  <>
                     <div className="absolute top-0 left-0 w-full h-1 md:h-2 bg-gradient-to-r from-orange-400 to-pink-500"></div>
                     
                     <div className="text-center mb-6">
                        <div className="inline-block bg-orange-500/20 text-orange-400 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest mb-3 border border-orange-500/30 shadow-sm">
                          {activeQuestion.type === 'mcq' && 'Multiple Choice'}
                          {activeQuestion.type === 'short_answer' && 'Short Answer'}
                          {activeQuestion.type === 'word_cloud' && 'Word Cloud'}
                          {activeQuestion.type === 'thumbs' && 'Quick Poll'}
                          {activeQuestion.type === 'temperature' && 'Temperature Check'}
                          {activeQuestion.type === 'rank' && 'Rank Order'}
                        </div>
                        <h2 className="text-xl sm:text-2xl font-bold text-white leading-tight">{activeQuestion.text}</h2>
                     </div>
                     
                     {!hasAnswered ? (
                       <div className="w-full flex-1 flex flex-col justify-center">
                         
                         {activeQuestion.type === 'mcq' && (
                            <div className="grid grid-cols-1 gap-3">
                              {activeQuestion.options.map((option, idx) => (
                                <button
                                  key={idx}
                                  onClick={() => submitAnswer(option)}
                                  className="w-full py-4 px-5 bg-slate-700 hover:bg-orange-600 text-white text-lg font-medium rounded-xl transition-all border border-slate-600 hover:border-orange-500 shadow-lg active:scale-95 text-left flex items-center justify-between group"
                                >
                                  <span>{option}</span>
                                  <div className="w-5 h-5 rounded-full border-2 border-slate-500 group-hover:border-white opacity-50 group-hover:opacity-100 flex-shrink-0 ml-3"></div>
                                </button>
                              ))}
                            </div>
                         )}

                         {activeQuestion.type === 'short_answer' && (
                            <div className="flex flex-col gap-4">
                               <textarea 
                                  placeholder="Type your answer here..."
                                  value={shortAnswerText}
                                  onChange={(e) => setShortAnswerText(e.target.value)}
                                  className="w-full bg-slate-900 border border-slate-600 rounded-xl p-4 text-white text-base focus:outline-none focus:border-orange-500 h-28 resize-none shadow-inner"
                               />
                               <button 
                                  onClick={() => { if(shortAnswerText.trim()) submitAnswer(shortAnswerText); }}
                                  className={`w-full py-4 rounded-xl font-bold text-lg transition-all ${shortAnswerText.trim() ? 'bg-orange-600 hover:bg-orange-500 text-white active:scale-95 shadow-lg shadow-orange-500/25' : 'bg-slate-700 text-slate-500 cursor-not-allowed'}`}
                               >
                                  Submit Answer
                               </button>
                            </div>
                         )}

                         {activeQuestion.type === 'word_cloud' && (
                             <div className="flex flex-col gap-4">
                                <p className="text-slate-400 text-sm text-center">Type <b className="text-white">one</b> short word or phrase!</p>
                                <input 
                                   type="text" 
                                   placeholder="e.g. Fantastic"
                                   maxLength={25}
                                   value={shortAnswerText}
                                   onChange={(e) => setShortAnswerText(e.target.value)}
                                   className="w-full bg-slate-900 border border-slate-600 rounded-xl p-4 text-white text-xl text-center font-bold focus:outline-none focus:border-orange-500 shadow-inner uppercase tracking-wider"
                                />
                                <button 
                                   onClick={() => { if(shortAnswerText.trim()) submitAnswer(shortAnswerText); }}
                                   className={`w-full py-4 rounded-xl font-bold text-lg transition-all ${shortAnswerText.trim() ? 'bg-orange-600 hover:bg-orange-500 text-white active:scale-95 shadow-lg shadow-orange-500/25' : 'bg-slate-700 text-slate-500 cursor-not-allowed'}`}
                                >
                                   Send to Word Cloud
                                </button>
                             </div>
                         )}

                         {activeQuestion.type === 'thumbs' && (
                            <div className="flex gap-3 justify-center">
                               <button onClick={() => submitAnswer('👍 Thumbs Up')} className="flex-1 py-8 bg-slate-700 hover:bg-emerald-600 rounded-2xl border border-slate-600 hover:border-emerald-500 transition-all active:scale-95 shadow-lg group">
                                  <div className="text-5xl mb-2 group-hover:scale-110 transition-transform">👍</div>
                                  <div className="text-white font-bold text-sm">Agree</div>
                               </button>
                               <button onClick={() => submitAnswer('👎 Thumbs Down')} className="flex-1 py-8 bg-slate-700 hover:bg-red-600 rounded-2xl border border-slate-600 hover:border-red-500 transition-all active:scale-95 shadow-lg group">
                                  <div className="text-5xl mb-2 group-hover:scale-110 transition-transform">👎</div>
                                  <div className="text-white font-bold text-sm">Disagree</div>
                               </button>
                            </div>
                         )}

                         {activeQuestion.type === 'temperature' && (
                            <div className="grid grid-cols-2 gap-3">
                               {[
                                 { e: '🥵', t: 'Overwhelmed' },
                                 { e: '😕', t: 'Confused' },
                                 { e: '😐', t: 'Neutral' },
                                 { e: '🙂', t: 'Getting It' },
                                 { e: '🤩', t: 'Mastered It' }
                               ].map((item, idx) => (
                                 <button 
                                    key={idx} 
                                    onClick={() => submitAnswer(`${item.e} ${item.t}`)}
                                    className={`flex flex-col items-center gap-1 p-3 bg-slate-700 hover:bg-orange-600 border border-slate-600 hover:border-orange-500 rounded-xl transition-all active:scale-95 shadow-md group ${idx === 4 ? 'col-span-2' : ''}`}
                                 >
                                    <div className="text-3xl group-hover:scale-125 transition-transform">{item.e}</div>
                                    <div className="text-white text-[11px] font-bold text-center uppercase tracking-wider">{item.t}</div>
                                 </button>
                               ))}
                            </div>
                         )}

                         {activeQuestion.type === 'rank' && (
                            <div className="flex flex-col gap-4">
                               <p className="text-slate-400 text-center text-xs">Tap items to rank them</p>
                               <div className="flex flex-col gap-2 min-h-[80px] p-3 bg-slate-900 border border-dashed border-slate-600 rounded-xl">
                                  {rankOrder.length === 0 ? (
                                     <div className="text-slate-500 text-center italic text-sm my-auto">Ranking order...</div>
                                  ) : (
                                     rankOrder.map((opt, idx) => (
                                        <button key={idx} onClick={() => handleRankClick(opt)} className="bg-blue-600 text-white font-semibold py-2 px-3 rounded-lg text-left flex gap-3 items-center shadow-md animate-in slide-in-from-bottom-2 text-sm">
                                           <span className="bg-black/30 w-6 h-6 rounded-md flex items-center justify-center text-xs">{idx + 1}</span>
                                           <span className="flex-1 truncate">{opt}</span>
                                        </button>
                                     ))
                                  )}
                               </div>
                               <div className="flex flex-wrap gap-2 justify-center">
                                  {activeQuestion.options.filter(o => !rankOrder.includes(o)).map((opt, idx) => (
                                     <button key={idx} onClick={() => handleRankClick(opt)} className="bg-slate-700 hover:bg-slate-600 border border-slate-500 text-white py-2 px-3 rounded-lg font-medium shadow-sm active:scale-95 transition-all text-sm">
                                        {opt}
                                     </button>
                                  ))}
                               </div>
                               {rankOrder.length === activeQuestion.options.length && (
                                  <button 
                                     onClick={() => submitAnswer(rankOrder)}
                                     className="w-full py-3 mt-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-lg transition-all shadow-lg active:scale-95 animate-in zoom-in"
                                  >
                                     Submit Order
                                  </button>
                               )}
                            </div>
                         )}
                       </div>
                     ) : (
                       <div className="text-center py-10 my-auto">
                         <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4 border-2 border-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.2)] animate-in zoom-in">
                            <svg className="w-8 h-8 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>
                         </div>
                         <h3 className="text-xl font-bold text-emerald-400 mb-2">Submitted!</h3>
                         <p className="text-slate-400 text-sm">Look up at the board...</p>
                       </div>
                     )}
                  </>
               )}
            </div>
         </div>
      </div>
    </div>
  );
}

function ProjectorView({ roomCode }) {
  const [activeSlide, setActiveSlide] = useState(null);
  const [activeQuestion, setActiveQuestion] = useState(null);
  const [answers, setAnswers] = useState([]);
  const [isPeerConnected, setIsPeerConnected] = useState(false);
  const videoRef = useRef(null);
  const peerRef = useRef(null);

  useEffect(() => {
    const sessionRef = doc(db, 'artifacts', appId, 'public', 'data', 'sessions', roomCode);
    const unsubscribe = onSnapshot(sessionRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setActiveSlide(data.activeSlide || null);
        setActiveQuestion(data.activeQuestion || null);
      }
    });
    return () => unsubscribe();
  }, [roomCode]);

  useEffect(() => {
    let unsubscribeAnswers = () => {};
    if (activeQuestion) {
      const answersRef = collection(db, 'artifacts', appId, 'public', 'data', 'sessions', roomCode, 'answers');
      unsubscribeAnswers = onSnapshot(answersRef, (snapshot) => {
        const results = [];
        snapshot.forEach(doc => results.push(doc.data()));
        setAnswers(results);
      });
    }
    return () => unsubscribeAnswers();
  }, [activeQuestion, roomCode]);

  useEffect(() => {
     if (activeSlide?.type === 'screen' && window.Peer && !isPeerConnected) {
         const peer = new window.Peer();
         peerRef.current = peer;
         const teacherId = `classcast-${appId}-${roomCode}-host`;

         peer.on('open', () => {
             const conn = peer.connect(teacherId);
             conn.on('open', () => {
                 setIsPeerConnected(true);
                 conn.send({ type: 'request-stream' });
             });
         });

         peer.on('call', (call) => {
             call.answer(); 
             call.on('stream', (stream) => {
                 if (videoRef.current) videoRef.current.srcObject = stream;
             });
         });

         return () => {
             peer.destroy();
             setIsPeerConnected(false);
         };
     }
  }, [activeSlide?.type, roomCode]);

  return (
    <div className="fixed inset-0 w-full h-full bg-black flex flex-col font-sans overflow-hidden z-50">
      
      <div className="absolute top-6 right-6 z-20 pointer-events-none">
        <div className="bg-black/80 backdrop-blur-md px-6 py-4 rounded-2xl border-2 border-emerald-500/50 shadow-[0_0_20px_rgba(16,185,129,0.3)] text-center">
          <div className="text-emerald-400 text-sm font-bold uppercase tracking-widest mb-1">Join Code</div>
          <div className="text-white text-5xl font-mono font-bold tracking-widest">{roomCode}</div>
        </div>
      </div>

      <div className="absolute inset-0 w-full h-full z-0 flex items-center justify-center">
         {!activeSlide ? (
            <div className="flex flex-col items-center justify-center scale-150">
               <svg className="w-32 h-32 text-emerald-600 mb-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
               <h1 className="text-white font-bold text-4xl mb-4">ClassCast Projector Ready</h1>
               <p className="text-slate-400 text-2xl">Use your Teacher Dashboard to sync media.</p>
            </div>
         ) : (
            <div className="w-full h-full bg-black relative">
               {activeSlide.type === 'screen' ? (
                  <>
                     {!isPeerConnected && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center z-20 bg-black pointer-events-none">
                           <div className="w-12 h-12 border-4 border-slate-700 border-t-emerald-500 rounded-full animate-spin mb-4"></div>
                        </div>
                     )}
                     <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-contain pointer-events-none" />
                  </>
               ) : (
                  <>
                     {parseMediaUrl(activeSlide.url, activeSlide.page)?.type === 'iframe' && (
                        <iframe 
                          src={parseMediaUrl(activeSlide.url, activeSlide.page).src} 
                          className="w-full h-full border-0 bg-black" 
                          allowFullScreen
                        />
                     )}
                     {parseMediaUrl(activeSlide.url, activeSlide.page)?.type === 'image' && (
                        <img src={parseMediaUrl(activeSlide.url, activeSlide.page).src} className="w-full h-full object-contain" />
                     )}
                  </>
               )}
            </div>
         )}
      </div>

      {activeQuestion && (
        <div className="absolute inset-0 z-50 flex items-center justify-center p-6 bg-black/90 backdrop-blur-md transition-all duration-300 pointer-events-none">
          <div className="bg-slate-800 rounded-[2rem] p-12 w-full max-w-5xl shadow-[0_0_60px_rgba(0,0,0,0.8)] border-2 border-slate-600 relative overflow-hidden flex flex-col max-h-[90vh]">
            <div className="absolute top-0 left-0 w-full h-3 bg-gradient-to-r from-orange-400 to-pink-500"></div>
            
            <div className="text-center mb-12 mt-4 flex-shrink-0">
               <div className="inline-block bg-orange-500/20 text-orange-400 px-6 py-2 rounded-full text-lg font-bold uppercase tracking-widest mb-6 border border-orange-500/30">
                 Live Class Activity
               </div>
               <h2 className="text-6xl font-bold text-white leading-tight">{activeQuestion.text}</h2>
            </div>
            
            <div className="flex-1 overflow-y-auto">
                {activeQuestion.type === 'word_cloud' && (
                    <div className="flex flex-wrap justify-center items-center gap-6 h-full p-8 bg-slate-900 rounded-[2rem] border-2 border-dashed border-slate-600">
                        {answers.length === 0 ? (
                           <p className="text-4xl text-slate-500 italic">Waiting for words...</p>
                        ) : (
                           getWordCloudData(answers).map(([word, count], i) => (
                               <span 
                                  key={word} 
                                  style={{ 
                                     fontSize: `${Math.min(3 + (count - 1) * 1.5, 9)}rem`,
                                     opacity: Math.min(0.6 + count * 0.2, 1)
                                  }} 
                                  className={`font-black tracking-tight transition-all duration-500 drop-shadow-xl ${wordCloudColors[i % wordCloudColors.length]}`}
                               >
                                  {word}
                               </span>
                           ))
                        )}
                    </div>
                )}

                {activeQuestion.type === 'mcq' && (
                  <div className="grid grid-cols-2 gap-8">
                    {activeQuestion.options.map((option, idx) => (
                      <div key={idx} className="w-full py-8 px-8 bg-slate-700 text-white text-4xl font-medium rounded-3xl border-2 border-slate-600 shadow-xl text-center">
                        {option}
                      </div>
                    ))}
                  </div>
                )}
                
                {activeQuestion.type === 'short_answer' && (
                   <div className="text-center py-12 bg-slate-900 border-2 border-dashed border-slate-600 rounded-3xl">
                      <p className="text-4xl text-slate-400 font-medium italic">✍️ Type your answers on your device...</p>
                   </div>
                )}

                {activeQuestion.type === 'thumbs' && (
                   <div className="flex gap-12 justify-center">
                      <div className="flex flex-col items-center gap-4 bg-slate-700 p-12 rounded-[3rem] border-2 border-slate-600">
                         <span className="text-8xl">👍</span><span className="text-white text-3xl font-bold mt-4">Yes / Agree</span>
                      </div>
                      <div className="flex flex-col items-center gap-4 bg-slate-700 p-12 rounded-[3rem] border-2 border-slate-600">
                         <span className="text-8xl">👎</span><span className="text-white text-3xl font-bold mt-4">No / Disagree</span>
                      </div>
                   </div>
                )}

                {activeQuestion.type === 'temperature' && (
                   <div className="flex justify-center gap-8">
                      {['🥵', '😕', '😐', '🙂', '🤩'].map((emoji, idx) => (
                         <div key={idx} className="bg-slate-700 p-8 rounded-full border-2 border-slate-600 flex items-center justify-center w-32 h-32 text-6xl shadow-xl">
                            {emoji}
                         </div>
                      ))}
                   </div>
                )}

                {activeQuestion.type === 'rank' && (
                   <div className="flex flex-wrap gap-4 justify-center">
                      {activeQuestion.options.map((opt, idx) => (
                         <div key={idx} className="bg-slate-700 text-white text-3xl font-bold py-6 px-10 rounded-2xl border-2 border-slate-500 shadow-lg">
                            {opt}
                         </div>
                      ))}
                      <p className="w-full text-center text-slate-400 text-2xl mt-8">🔢 Tap items in order on your screen to rank them!</p>
                   </div>
                )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}