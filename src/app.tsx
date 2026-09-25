import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  setDoc, 
  onSnapshot, 
  collection, 
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

const generateRoomCode = () => {
  return Math.floor(10000 + Math.random() * 90000).toString(); 
};

const parseMediaUrl = (url, page = 1) => {
    if (!url) return null;
    
    // Google Slides Detection (Extracted Presentation ID)
    if (url.includes('docs.google.com/presentation')) {
        const match = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
        if (match && match[1]) {
            const embedUrl = `https://docs.google.com/presentation/d/${match[1]}/embed?rm=minimal&slide=${page}`;
            return { type: 'iframe', src: embedUrl };
        }
    }
    
    // YouTube Detection
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
  const [isTeacherLink, setIsTeacherLink] = useState(false);

  const urlParams = new URLSearchParams(window.location.search);
  const isProjector = urlParams.get('projector') === 'true';
  const projCode = urlParams.get('code');

  useEffect(() => {
    const authenticate = async () => {
      try {
        await signInAnonymously(auth);
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
        setIsTeacherLink(true);
    }

    return () => unsubscribe();
  }, []);

  if (!user) {
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
      <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-800 p-8 rounded-2xl shadow-2xl border border-slate-700 text-center relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-400 to-blue-500"></div>
          <h1 className="text-4xl font-extrabold mb-2 text-white flex items-center justify-center gap-3">
             <svg className="w-8 h-8 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
             ClassCast
          </h1>
          <p className="text-slate-400 mb-8 text-sm">Interactive Cloud Presentation</p>
          
          {errorMsg && (
            <div className="bg-red-900/50 border border-red-500 text-red-200 p-3 rounded-lg mb-6 text-sm">
              {errorMsg}
            </div>
          )}

          <div className="space-y-4">
            {isTeacherLink && (
               <>
                <button 
                  onClick={() => {
                    setRoomCode(generateRoomCode());
                    setRole('teacher');
                  }}
                  className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold transition-all shadow-lg hover:shadow-blue-500/25 active:scale-95"
                >
                  Start as Teacher (Host)
                </button>
                <div className="relative flex py-2 items-center">
                  <div className="flex-grow border-t border-slate-600"></div>
                  <span className="flex-shrink-0 mx-4 text-slate-500 text-sm">or join class</span>
                  <div className="flex-grow border-t border-slate-600"></div>
                </div>
               </>
            )}

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
          </div>
        </div>
      </div>
    );
  }

  return role === 'teacher' ? (
    <TeacherView roomCode={roomCode} />
  ) : (
    <StudentView user={user} roomCode={roomCode} studentName={studentName} />
  );
}

function TeacherView({ roomCode }) {
  // Slide State
  const [slideUrl, setSlideUrl] = useState('');
  const [activeSlide, setActiveSlide] = useState(null);
  
  // Question State & Bank
  const [activeQuestion, setActiveQuestion] = useState(null);
  const [answers, setAnswers] = useState([]);
  const [errorMsg, setErrorMsg] = useState('');
  const [questionBank, setQuestionBank] = useState([]);
  
  // Question Builder Form
  const [qType, setQType] = useState('mcq');
  const [qText, setQText] = useState('');
  const [qOptions, setQOptions] = useState(['', '']);

  const openProjector = () => {
     window.open(`/?projector=true&code=${roomCode}`, 'ClassCastProjector', 'width=1280,height=720');
  };

  // Sync Answers and Question Bank from Firebase
  useEffect(() => {
    const sessionRef = doc(db, 'artifacts', appId, 'public', 'data', 'sessions', roomCode);
    const unsubscribeSession = onSnapshot(sessionRef, (docSnap) => {
       if (docSnap.exists()) {
           const data = docSnap.data();
           setQuestionBank(data.bank || []);
       }
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
        unsubscribeSession();
        unsubscribeAnswers();
    };
  }, [activeQuestion, roomCode]);

  const pushSlide = async () => {
    if (!slideUrl) return;
    try {
      const sessionRef = doc(db, 'artifacts', appId, 'public', 'data', 'sessions', roomCode);
      const slideData = { url: slideUrl, page: 1, timestamp: Date.now() };
      await setDoc(sessionRef, { activeSlide: slideData }, { merge: true });
      setActiveSlide(slideData);
      setSlideUrl(''); 
      setErrorMsg('');
    } catch (err) {
      setErrorMsg("Failed to push slide.");
    }
  };

  const changePage = async (delta) => {
    if (!activeSlide) return;
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
    try {
      const sessionRef = doc(db, 'artifacts', appId, 'public', 'data', 'sessions', roomCode);
      await setDoc(sessionRef, { activeSlide: null }, { merge: true });
      setActiveSlide(null);
    } catch (err) {}
  };

  const updateOption = (index, value) => {
      const newOptions = [...qOptions];
      newOptions[index] = value;
      setQOptions(newOptions);
  };

  const addOption = () => setQOptions([...qOptions, '']);
  const removeOption = (index) => setQOptions(qOptions.filter((_, i) => i !== index));

  const saveToBank = async () => {
      if (!qText.trim()) {
          setErrorMsg("Question text cannot be empty.");
          return;
      }
      if ((qType === 'mcq' || qType === 'rank') && qOptions.some(o => !o.trim())) {
          setErrorMsg("Please fill out all options or remove empty ones.");
          return;
      }

      const newQuestion = {
          id: Date.now().toString(),
          type: qType,
          text: qText,
          options: (qType === 'mcq' || qType === 'rank') ? qOptions.filter(o => o.trim()) : [],
      };

      try {
          const sessionRef = doc(db, 'artifacts', appId, 'public', 'data', 'sessions', roomCode);
          await setDoc(sessionRef, { bank: [...questionBank, newQuestion] }, { merge: true });
          setQText('');
          setQOptions(['', '']);
          setErrorMsg('');
      } catch (err) {
          setErrorMsg("Failed to save to bank.");
      }
  };

  const deleteFromBank = async (qId) => {
      const newBank = questionBank.filter(q => q.id !== qId);
      const sessionRef = doc(db, 'artifacts', appId, 'public', 'data', 'sessions', roomCode);
      await setDoc(sessionRef, { bank: newBank }, { merge: true });
  };

  const launchQuestion = async (questionObj) => {
    try {
      const sessionRef = doc(db, 'artifacts', appId, 'public', 'data', 'sessions', roomCode);
      await setDoc(sessionRef, { activeQuestion: questionObj }, { merge: true });
      setActiveQuestion(questionObj);
      setAnswers([]); // Reset answers locally when launching new question
    } catch (err) {
      setErrorMsg("Failed to send question to class.");
    }
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
      
      {/* Left Column: Presentation & Control */}
      <div className="flex-1 flex flex-col gap-6">
        <div className="bg-slate-800 rounded-2xl p-6 shadow-xl border border-slate-700 flex justify-between items-center relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>
          <div>
            <h2 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
               Teacher Dashboard
            </h2>
            <p className="text-slate-400">Class Code: <span className="text-emerald-400 font-mono text-2xl font-bold tracking-widest ml-2 bg-slate-900 px-3 py-1 rounded-lg border border-slate-700">{roomCode}</span></p>
          </div>
          <button 
             onClick={openProjector} 
             className="px-6 py-3 bg-purple-600 hover:bg-purple-500 rounded-xl font-bold transition-all shadow-lg flex items-center gap-2 active:scale-95"
          >
             <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
             Launch Projector
          </button>
        </div>

        {errorMsg && (
          <div className="bg-red-900/50 border border-red-500 text-red-200 p-4 rounded-xl shadow-lg">
            {errorMsg}
          </div>
        )}

        {/* Presentation Deck */}
        <div className="bg-slate-800 rounded-2xl p-6 shadow-xl border border-slate-700 flex flex-col gap-4 flex-1">
           <h3 className="text-xl font-bold text-slate-100 border-b border-slate-700 pb-3 flex items-center gap-2">
              <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
              Cloud Presentation Sync
           </h3>
           
           <div className="flex gap-2">
              <input 
                 type="text" 
                 placeholder="Paste a Google Slides URL, Image Link, or YouTube Link..." 
                 value={slideUrl}
                 onChange={(e) => setSlideUrl(e.target.value)}
                 className="flex-1 bg-slate-900 border border-slate-600 rounded-xl p-4 text-white focus:outline-none focus:border-emerald-500 font-mono text-sm"
              />
              <button 
                 onClick={pushSlide}
                 className="px-8 py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold transition-all shadow-lg active:scale-95"
              >
                 Sync to Class
              </button>
           </div>

           <div className="flex-1 bg-black rounded-xl overflow-hidden border border-slate-700 relative flex items-center justify-center min-h-[350px]">
              {activeSlide ? (
                 <>
                    <div className="absolute top-2 left-2 bg-black/60 px-3 py-1 rounded-md text-xs font-mono z-20 flex gap-2 shadow-lg backdrop-blur-sm border border-slate-600">
                       <span className="text-emerald-400 flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div> Live on student screens</span>
                       <button onClick={clearSlide} className="text-red-400 hover:text-red-300 ml-2 underline ml-4 border-l border-slate-600 pl-4">Clear Screen</button>
                    </div>
                    
                    {parseMediaUrl(activeSlide.url, activeSlide.page)?.type === 'iframe' && (
                       <div className="w-full h-full flex flex-col relative">
                          <iframe 
                            src={parseMediaUrl(activeSlide.url, activeSlide.page).src} 
                            className="w-full flex-1 border-0 bg-white" 
                            allowFullScreen
                          />
                          {activeSlide.url.includes('docs.google.com/presentation') && (
                              <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-slate-900/95 p-3 rounded-2xl border-2 border-slate-600 flex items-center gap-6 z-30 shadow-2xl backdrop-blur-md">
                                 <button onClick={() => changePage(-1)} className="px-5 py-2 bg-slate-700 hover:bg-slate-600 rounded-xl text-white font-bold transition-all shadow-md active:scale-95">&larr; Prev Slide</button>
                                 <span className="text-emerald-400 font-bold whitespace-nowrap text-lg">Slide {activeSlide.page || 1}</span>
                                 <button onClick={() => changePage(1)} className="px-5 py-2 bg-slate-700 hover:bg-slate-600 rounded-xl text-white font-bold transition-all shadow-md active:scale-95">Next Slide &rarr;</button>
                              </div>
                          )}
                       </div>
                    )}

                    {parseMediaUrl(activeSlide.url, activeSlide.page)?.type === 'image' && (
                       <img 
                          src={parseMediaUrl(activeSlide.url, activeSlide.page).src} 
                          className="w-full h-full object-contain" 
                          alt="Teacher Slide Preview" 
                       />
                    )}
                 </>
              ) : (
                 <div className="text-center text-slate-500">
                    <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
                    <p>Enter a URL above to display it to the class instantly.</p>
                 </div>
              )}
           </div>
        </div>
      </div>

      {}
      <div className="w-full md:w-[450px] flex flex-col gap-6">
        
        {/* Active Live Question Panel */}
        {activeQuestion && (
           <div className="bg-slate-800 rounded-2xl p-6 shadow-xl border-2 border-orange-500 relative overflow-hidden animate-in fade-in">
              <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-orange-400 to-pink-500"></div>
              <div className="flex justify-between items-center mb-4">
                 <h3 className="text-xl font-bold text-orange-400 flex items-center gap-2">
                   <div className="w-3 h-3 bg-orange-500 rounded-full animate-pulse"></div> Live Session
                 </h3>
                 <button onClick={clearQuestion} className="text-sm bg-slate-700 hover:bg-slate-600 px-3 py-1 rounded text-white border border-slate-600">Close Question</button>
              </div>
              <p className="font-semibold text-white text-lg mb-4">{activeQuestion.text}</p>
              
              <div className="bg-slate-900 rounded-xl p-4 border border-slate-700 max-h-64 overflow-y-auto space-y-2">
                 {answers.length === 0 ? (
                    <p className="text-slate-500 text-center italic text-sm">Waiting for student responses...</p>
                 ) : (
                    answers.map((ans, idx) => (
                      <div key={idx} className="bg-slate-800 p-3 rounded-lg border border-slate-700 flex flex-col gap-1">
                        <span className="font-medium text-slate-300 text-sm">{ans.studentName}</span>
                        <span className="text-white font-bold bg-blue-500/20 px-3 py-1.5 rounded inline-block border border-blue-500/30 break-words">
                          {Array.isArray(ans.selectedOption) ? ans.selectedOption.join(' ➔ ') : ans.selectedOption}
                        </span>
                      </div>
                    ))
                 )}
              </div>
           </div>
        )}

        {/* Question Builder & Bank (Hides when a question is active) */}
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
                       <option value="thumbs">👍 Thumbs Up / Down</option>
                       <option value="temperature">🌡️ Temperature Check (Emoji)</option>
                       <option value="rank">🔢 Rank / Order Items</option>
                    </select>

                    <textarea 
                      placeholder="Type your question here..." 
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
                                   <button onClick={() => removeOption(i)} className="p-2 bg-red-900/50 text-red-400 hover:bg-red-500 hover:text-white rounded-lg border border-red-500/30 transition-colors">
                                      ✕
                                   </button>
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
                      Save to Question Bank
                    </button>
                 </div>
              </div>

              <div className="flex-1 p-6 overflow-y-auto bg-slate-900/50">
                 <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Saved Questions ({questionBank.length})</h4>
                 <div className="space-y-3">
                    {questionBank.length === 0 ? (
                       <p className="text-slate-500 text-sm italic text-center mt-6">Build questions above to save them for class.</p>
                    ) : (
                       questionBank.map((q) => (
                          <div key={q.id} className="bg-slate-800 p-4 rounded-xl border border-slate-600 shadow-sm flex flex-col gap-3 group">
                             <div className="flex justify-between items-start gap-2">
                                <span className="font-medium text-white text-sm leading-snug">{q.text}</span>
                                <span className="text-xs px-2 py-1 bg-slate-700 rounded text-slate-300 whitespace-nowrap">
                                   {q.type === 'mcq' && 'MCQ'}
                                   {q.type === 'short_answer' && 'Short Ans'}
                                   {q.type === 'thumbs' && 'Thumbs'}
                                   {q.type === 'temperature' && 'Temp'}
                                   {q.type === 'rank' && 'Rank'}
                                </span>
                             </div>
                             <div className="flex gap-2 mt-1">
                                <button 
                                   onClick={() => launchQuestion(q)}
                                   className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-2 rounded-lg font-bold text-sm transition-colors shadow-md active:scale-95"
                                >
                                   Launch Live
                                </button>
                                <button 
                                   onClick={() => deleteFromBank(q.id)}
                                   className="px-3 bg-slate-700 hover:bg-red-600 text-slate-300 hover:text-white rounded-lg transition-colors border border-slate-600"
                                >
                                   🗑️
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

  // Specific states for different question types
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

  const submitAnswer = async (payload) => {
    if (!activeQuestion) return;
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
      
      {/* Floating Header */}
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

      {/* Main Split Layout */}
      <div className="flex-1 w-full h-full flex flex-col md:flex-row relative z-0">
         
         {/* Presentation Layer (Squeezes smoothly when sidebar opens) */}
         <div className="flex-1 h-full relative bg-black flex items-center justify-center transition-all duration-500 overflow-hidden">
            {!activeSlide ? (
               <div className="flex flex-col items-center justify-center scale-110">
                  <svg className="w-24 h-24 text-slate-700 mb-6 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
                  <p className="text-slate-500 font-medium text-xl tracking-wide">Waiting for teacher's presentation...</p>
               </div>
            ) : (
               <div className="w-full h-full bg-black">
                  {/* Invisible Glass Shield to block student clicks */}
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
               </div>
            )}
         </div>

         {/* Responsive Sidebar (Slides in on right for Desktop, bottom for Mobile) */}
         <div 
           className={`bg-slate-800 shadow-[-20px_0_40px_rgba(0,0,0,0.6)] flex flex-col transition-all duration-500 ease-in-out relative z-30 overflow-hidden
           ${activeQuestion ? 'h-[55%] md:h-full w-full md:w-[420px] border-t md:border-t-0 md:border-l border-orange-500/50' : 'h-0 md:h-full w-full md:w-0 border-none'}`}
         >
            <div className="w-full md:w-[420px] h-full overflow-y-auto relative p-6 pt-16 md:pt-24 flex flex-col">
               {activeQuestion && (
                  <>
                     <div className="absolute top-0 left-0 w-full h-1 md:h-2 bg-gradient-to-r from-orange-400 to-pink-500"></div>
                     
                     {/* Sidebar Title Area */}
                     <div className="text-center mb-6">
                        <div className="inline-block bg-orange-500/20 text-orange-400 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest mb-3 border border-orange-500/30 shadow-sm">
                          {activeQuestion.type === 'mcq' && 'Multiple Choice'}
                          {activeQuestion.type === 'short_answer' && 'Short Answer'}
                          {activeQuestion.type === 'thumbs' && 'Quick Poll'}
                          {activeQuestion.type === 'temperature' && 'Temperature Check'}
                          {activeQuestion.type === 'rank' && 'Rank Order'}
                        </div>
                        <h2 className="text-xl sm:text-2xl font-bold text-white leading-tight">{activeQuestion.text}</h2>
                     </div>
                     
                     {/* Answer Options Area (Scaled perfectly for Sidebar) */}
                     {!hasAnswered ? (
                       <div className="w-full flex-1 flex flex-col justify-center">
                         
                         {/* 1. Multiple Choice */}
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

                         {/* 2. Short Answer */}
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

                         {/* 3. Thumbs Up/Down */}
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

                         {/* 4. Temperature Check */}
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

                         {/* 5. Rank Order */}
                         {activeQuestion.type === 'rank' && (
                            <div className="flex flex-col gap-4">
                               <p className="text-slate-400 text-center text-xs">Tap items to rank them</p>
                               
                               {/* Slots (Selected) */}
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

                               {/* Pool (Unselected) */}
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
            <div className="w-full h-full bg-black">
               {/* No Glass Shield here, Teacher can click! */}
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
            </div>
         )}
      </div>

      {activeQuestion && (
        <div className="absolute inset-0 z-50 flex items-center justify-center p-6 bg-black/90 backdrop-blur-md transition-all duration-300 pointer-events-none">
          <div className="bg-slate-800 rounded-[2rem] p-12 w-full max-w-5xl shadow-[0_0_60px_rgba(0,0,0,0.8)] border-2 border-slate-600 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-3 bg-gradient-to-r from-orange-400 to-pink-500"></div>
            
            <div className="text-center mb-12 mt-4">
               <div className="inline-block bg-orange-500/20 text-orange-400 px-6 py-2 rounded-full text-lg font-bold uppercase tracking-widest mb-6 border border-orange-500/30">
                 Live Class Activity
               </div>
               <h2 className="text-6xl font-bold text-white leading-tight">{activeQuestion.text}</h2>
            </div>
            
            {/* Projector read-only displays for the new question types */}
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
      )}
    </div>
  );
}