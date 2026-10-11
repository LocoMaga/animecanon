import React, { useState, useEffect, useMemo } from 'react';
import { 
  Calendar, Clock, CheckCircle2, Circle, ExternalLink, 
  Search, ArrowLeft, Star, Play, Flame, 
  Globe, X, ShieldCheck, AlertCircle, PlayCircle, Layers, Loader2, ListOrdered, User, LogOut, Home, Compass, ChevronDown, MessageSquare, Plus, Send, Trash2, MessageCircle, CornerDownRight, Award, Bookmark, Sparkles, Check, Filter, EyeOff, Edit3, Save
} from 'lucide-react';
import { searchSagasFromAniList, fetchPopularAnimesByGenre, fetchTrendingAnimes, fetchNewestAnimes } from './services/jikanApi';
import { supabase } from './lib/supabase';
import AuthModal from './components/AuthModal';

const GENRES_LIST = ['Todos', 'Action', 'Fantasy', 'Romance', 'Adventure', 'Sci-Fi', 'Supernatural', 'Comedy', 'Drama', 'Slice of Life'];

// Componente de Fila Estilo Netflix
function AnimeRow({ title, icon: Icon, items, onSelectAnime, emptyMessage, myList, onToggleList }) {
  if (!items || items.length === 0) {
    if (!emptyMessage) return null;
    return (
      <div className="mb-10">
        <h3 className="text-xl font-black text-white tracking-tight flex items-center gap-2 mb-3">
          {Icon && <Icon className="text-purple-400" size={20} />} {title}
        </h3>
        <p className="text-xs text-slate-500 bg-slate-900/40 p-4 rounded-2xl border border-slate-800/60">
          {emptyMessage}
        </p>
      </div>
    );
  }

  return (
    <div className="mb-10">
      <h3 className="text-xl font-black text-white tracking-tight flex items-center gap-2 mb-4">
        {Icon && <Icon className="text-purple-400" size={20} />} {title}
      </h3>
      <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-purple-900 scrollbar-track-transparent">
        {items.map((anime) => {
          const isInMyList = myList && myList.includes(anime.id);

          return (
            <div
              key={anime.id}
              className="group relative flex-none w-36 sm:w-44 bg-slate-900 rounded-2xl overflow-hidden border border-slate-800 hover:border-purple-500 transition-all hover:-translate-y-1.5 shadow-lg"
            >
              <div className="absolute top-2 left-2 z-20 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleList(anime);
                  }}
                  title={isInMyList ? "Quitar de mi lista" : "Añadir a mi lista"}
                  className={`w-9 h-9 rounded-full flex items-center justify-center shadow-lg backdrop-blur-md transition-all ${
                    isInMyList 
                      ? 'bg-emerald-600 text-white border border-emerald-400' 
                      : 'bg-slate-950/80 text-white hover:bg-purple-600 border border-slate-700'
                  }`}
                >
                  {isInMyList ? <Check size={16} /> : <Plus size={18} />}
                </button>
              </div>

              <div 
                onClick={() => onSelectAnime(anime.queryName || anime.title)}
                className="relative aspect-[3/4] overflow-hidden bg-slate-950 cursor-pointer"
              >
                <img
                  src={anime.cover}
                  alt={anime.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent opacity-90" />
                <div className="absolute top-2 right-2 bg-slate-950/80 backdrop-blur px-2 py-0.5 rounded-lg border border-slate-800 text-[10px] font-black text-amber-400 flex items-center gap-1">
                  <Star size={10} fill="#fbbf24" /> {anime.rating || 'N/A'}
                </div>
              </div>
              
              <div 
                onClick={() => onSelectAnime(anime.queryName || anime.title)}
                className="p-3 cursor-pointer"
              >
                <span className="text-[9px] font-bold text-purple-400 uppercase block tracking-wider truncate">
                  {anime.subtitle || 'Saga'}
                </span>
                <h4 className="font-extrabold text-xs text-white truncate mt-0.5">
                  {anime.title}
                </h4>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function App() {
  const [view, setView] = useState('home'); // 'home', 'forum', 'profile'
  const [dynamicSagas, setDynamicSagas] = useState([]);
  const [activeSagaId, setActiveSagaId] = useState(null);

  // Carruseles
  const [catalogAnimes, setCatalogAnimes] = useState([]);
  const [trendingAnimes, setTrendingAnimes] = useState([]);
  const [newestAnimes, setNewestAnimes] = useState([]);
  const [isCatalogLoading, setIsCatalogLoading] = useState(true);

  // Cache/Registro de Sagas Conocidas/Buscadas
  const [knownSagasMap, setKnownSagasMap] = useState(() => {
    const saved = localStorage.getItem('animecanon_known_sagas');
    return saved ? JSON.parse(saved) : {};
  });

  const [selectedSeasonForEpisodes, setSelectedSeasonForEpisodes] = useState(null);
  const [selectedStreamingItem, setSelectedStreamingItem] = useState(null);

  // Filtro de Omitir Relleno
  const [hideFillerInSaga, setHideFillerInSaga] = useState(false);
  const [hideFillerInModal, setHideFillerInModal] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGenre, setSelectedGenre] = useState('Todos');
  const [isGenreMenuOpen, setIsGenreMenuOpen] = useState(false);

  const [isSearching, setIsSearching] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  const [user, setUser] = useState(null);
  const [username, setUsername] = useState('');
  const [editUsernameInput, setEditUsernameInput] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileSuccessMsg, setProfileSuccessMsg] = useState('');

  // Estados del Foro
  const [forumPosts, setForumPosts] = useState([]);
  const [isForumLoading, setIsForumLoading] = useState(false);
  const [newPostTitle, setNewPostTitle] = useState('');
  const [newPostContent, setNewPostContent] = useState('');
  const [isCreatingPost, setIsCreatingPost] = useState(false);

  const [activeCommentsPostId, setActiveCommentsPostId] = useState(null);
  const [postComments, setPostComments] = useState({});
  const [newReplyText, setNewReplyText] = useState('');

  const [watchedList, setWatchedList] = useState(() => {
    const saved = localStorage.getItem('animecanon_watched');
    return saved ? JSON.parse(saved) : [];
  });

  const [myList, setMyList] = useState(() => {
    const saved = localStorage.getItem('animecanon_mylist');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    const loadHomeData = async () => {
      setIsCatalogLoading(true);
      const [byGenre, trending, newest] = await Promise.all([
        fetchPopularAnimesByGenre(selectedGenre),
        fetchTrendingAnimes(),
        fetchNewestAnimes()
      ]);
      setCatalogAnimes(byGenre);
      setTrendingAnimes(trending);
      setNewestAnimes(newest);
      setIsCatalogLoading(false);
    };
    loadHomeData();
  }, [selectedGenre]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user);
        const metaName = session.user.user_metadata?.username;
        if (metaName) {
          setUsername(metaName);
          setEditUsernameInput(metaName);
        }
        fetchUserProfile(session.user.id);
        fetchUserProgress(session.user.id);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser(session.user);
        const metaName = session.user.user_metadata?.username;
        if (metaName) {
          setUsername(metaName);
          setEditUsernameInput(metaName);
        }
        fetchUserProfile(session.user.id);
        fetchUserProgress(session.user.id);
      } else {
        setUser(null);
        setUsername('');
        setEditUsernameInput('');
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const registerKnownAnime = (animeObj) => {
    if (!animeObj || !animeObj.id) return;
    setKnownSagasMap(prev => {
      const updated = { ...prev, [animeObj.id]: animeObj };
      localStorage.setItem('animecanon_known_sagas', JSON.stringify(updated));
      return updated;
    });
  };

  const toggleMyList = (animeOrId) => {
    const animeId = typeof animeOrId === 'object' ? animeOrId.id : animeOrId;
    if (typeof animeOrId === 'object') {
      registerKnownAnime(animeOrId);
    }

    let updated;
    if (myList.includes(animeId)) {
      updated = myList.filter(id => id !== animeId);
    } else {
      updated = [...myList, animeId];
    }
    setMyList(updated);
    localStorage.setItem('animecanon_mylist', JSON.stringify(updated));
  };

  const fetchForumPosts = async () => {
    setIsForumLoading(true);
    try {
      const { data, error } = await supabase
        .from('forum_posts')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setForumPosts(data || []);
      
      if (data && data.length > 0) {
        fetchAllComments();
      }
    } catch (err) {
      console.error('Error al cargar posts del foro:', err);
    } finally {
      setIsForumLoading(false);
    }
  };

  const fetchAllComments = async () => {
    try {
      const { data, error } = await supabase
        .from('forum_comments')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) throw error;

      const commentsMap = {};
      (data || []).forEach(comm => {
        if (!commentsMap[comm.post_id]) commentsMap[comm.post_id] = [];
        commentsMap[comm.post_id].push(comm);
      });
      setPostComments(commentsMap);
    } catch (err) {
      console.error('Error al cargar comentarios:', err);
    }
  };

  useEffect(() => {
    if (view === 'forum') {
      fetchForumPosts();
    }
  }, [view]);

  const handleCreatePost = async (e) => {
    e.preventDefault();
    if (!newPostTitle.trim() || !newPostContent.trim()) return;

    if (!user) {
      setIsAuthModalOpen(true);
      return;
    }

    try {
      const { error } = await supabase.from('forum_posts').insert([
        {
          user_id: user.id,
          username: username || user.user_metadata?.username || user.email.split('@')[0],
          title: newPostTitle,
          content: newPostContent
        }
      ]);

      if (error) throw error;

      setNewPostTitle('');
      setNewPostContent('');
      setIsCreatingPost(false);
      fetchForumPosts();
    } catch (err) {
      console.error('Error al publicar en el foro:', err);
    }
  };

  const handleDeletePost = async (postId) => {
    if (!window.confirm('¿Estás seguro de que deseas eliminar esta publicación?')) return;
    try {
      const { error } = await supabase.from('forum_posts').delete().eq('id', postId);
      if (error) throw error;
      fetchForumPosts();
    } catch (err) {
      console.error('Error al eliminar post:', err);
    }
  };

  const handleAddComment = async (postId) => {
    if (!newReplyText.trim()) return;

    if (!user) {
      setIsAuthModalOpen(true);
      return;
    }

    try {
      const { error } = await supabase.from('forum_comments').insert([
        {
          post_id: postId,
          user_id: user.id,
          username: username || user.user_metadata?.username || user.email.split('@')[0],
          content: newReplyText
        }
      ]);

      if (error) throw error;

      setNewReplyText('');
      fetchAllComments();
    } catch (err) {
      console.error('Error al responder:', err);
    }
  };

  const handleDeleteComment = async (commentId) => {
    try {
      const { error } = await supabase.from('forum_comments').delete().eq('id', commentId);
      if (error) throw error;
      fetchAllComments();
    } catch (err) {
      console.error('Error al eliminar comentario:', err);
    }
  };

  const fetchUserProfile = async (userId) => {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', userId)
        .maybeSingle();

      if (data && data.username) {
        setUsername(data.username);
        setEditUsernameInput(data.username);
      }
    } catch (err) {
      console.error('Error al cargar perfil:', err);
    }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    if (!editUsernameInput.trim() || !user) return;

    setIsSavingProfile(true);
    setProfileSuccessMsg('');

    try {
      const { error } = await supabase
        .from('profiles')
        .upsert({ id: user.id, username: editUsernameInput.trim() });

      if (error) throw error;

      setUsername(editUsernameInput.trim());
      setProfileSuccessMsg('¡Nombre de usuario actualizado con éxito!');
      setTimeout(() => setProfileSuccessMsg(''), 3000);
    } catch (err) {
      console.error('Error al actualizar perfil:', err);
    } finally {
      setIsSavingProfile(false);
    }
  };

  const fetchUserProgress = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('user_progress')
        .select('item_id')
        .eq('user_id', userId);

      if (error) throw error;
      if (data) setWatchedList(data.map(row => row.item_id));
    } catch (err) {
      console.error('Error al cargar progreso:', err);
    }
  };

  const toggleWatched = async (id, itemObj = null) => {
    if (itemObj) registerKnownAnime(itemObj);

    const isAlreadyWatched = watchedList.includes(id);
    // Limpia las subclaves asociadas (por ejemplo episodios si desmarcas una entrega)
    let updated = isAlreadyWatched 
      ? watchedList.filter(item => item !== id && !item.startsWith(`${id}-ep-`)) 
      : [...watchedList, id];

    setWatchedList(updated);

    if (user) {
      if (isAlreadyWatched) {
        await supabase.from('user_progress').delete().eq('user_id', user.id).eq('item_id', id);
      } else {
        await supabase.from('user_progress').insert([{ user_id: user.id, item_id: id }]);
      }
    } else {
      localStorage.setItem('animecanon_watched', JSON.stringify(updated));
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setUsername('');
    setEditUsernameInput('');
  };

  const goHome = () => {
    setView('home');
    setActiveSagaId(null);
    setSelectedSeasonForEpisodes(null);
    setSelectedStreamingItem(null);
    setSearchQuery('');
    setSelectedGenre('Todos');
  };

  useEffect(() => {
    if (!searchQuery || searchQuery.trim().length < 2) {
      setDynamicSagas([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const timer = setTimeout(async () => {
      const results = await searchSagasFromAniList(searchQuery);
      setDynamicSagas(results);

      results.forEach(s => registerKnownAnime(s));

      setIsSearching(false);
    }, 400);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleOpenPresetSaga = async (queryName) => {
    setIsSearching(true);
    setIsModalOpen(true);
    setSearchQuery(queryName);
    const results = await searchSagasFromAniList(queryName);
    if (results && results.length > 0) {
      setDynamicSagas(results);
      results.forEach(s => registerKnownAnime(s));
      setActiveSagaId(results[0].id);
      setIsModalOpen(false);
    }
    setIsSearching(false);
  };

  const currentSaga = useMemo(() => {
    return dynamicSagas.find(s => s.id === activeSagaId) || knownSagasMap[activeSagaId];
  }, [dynamicSagas, activeSagaId, knownSagasMap]);

  const sortedItems = useMemo(() => {
    if (!currentSaga || !currentSaga.items) return [];
    let items = [...currentSaga.items].sort((a, b) => (a.rawDateValue || 0) - (b.rawDateValue || 0));
    
    if (hideFillerInSaga) {
      items = items.filter(item => item.type === 'TV' || item.type === 'MOVIE');
    }

    return items;
  }, [currentSaga, hideFillerInSaga]);

  const sagaProgressPercent = useMemo(() => {
    if (!currentSaga || !currentSaga.items || currentSaga.items.length === 0) return 0;
    const completedCount = currentSaga.items.filter(item => watchedList.includes(item.id)).length;
    return Math.round((completedCount / currentSaga.items.length) * 100);
  }, [currentSaga, watchedList]);

  const allKnownAnimesMap = useMemo(() => {
    const map = new Map(Object.entries(knownSagasMap));
    [...catalogAnimes, ...trendingAnimes, ...newestAnimes].forEach(anime => {
      map.set(anime.id, anime);
    });
    return map;
  }, [catalogAnimes, trendingAnimes, newestAnimes, knownSagasMap]);

  const allKnownAnimesList = useMemo(() => {
    return Array.from(allKnownAnimesMap.values());
  }, [allKnownAnimesMap]);

  // CONTINUAR VIENDO: Solo muestra si hay entregas marcadas pero NO está el 100% completado
  const continuingAnimes = useMemo(() => {
    return allKnownAnimesList.filter(anime => {
      const items = anime.items && anime.items.length > 0 ? anime.items : [{ id: anime.id }];
      const watchedCount = items.filter(item => watchedList.includes(item.id)).length;
      return watchedCount > 0 && watchedCount < items.length;
    });
  }, [allKnownAnimesList, watchedList]);

  const myListAnimes = useMemo(() => {
    return allKnownAnimesList.filter(anime => myList.includes(anime.id));
  }, [allKnownAnimesList, myList]);

  // ANIMES TERMINADOS (PERFIL): Se muestra si TODAS sus entregas/temporadas están marcadas como vistas
  const completedAnimes = useMemo(() => {
    return allKnownAnimesList.filter(anime => {
      const items = anime.items && anime.items.length > 0 ? anime.items : [{ id: anime.id }];
      return items.length > 0 && items.every(item => watchedList.includes(item.id));
    });
  }, [allKnownAnimesList, watchedList]);

  const seasonEpisodesList = useMemo(() => {
    if (!selectedSeasonForEpisodes) return [];
    
    const match = selectedSeasonForEpisodes.episodes?.match(/\d+/);
    const totalEps = selectedSeasonForEpisodes.episodesCount || (match ? parseInt(match[0], 10) : 1);
    const isMovieOrOva = selectedSeasonForEpisodes.type === 'MOVIE' || selectedSeasonForEpisodes.type === 'OVA';

    const episodes = [];
    for (let i = 1; i <= totalEps; i++) {
      let status = isMovieOrOva ? 'mixed' : 'canon';
      let label = isMovieOrOva ? 'Especial / Película' : 'Canon (Fiel al Manga)';

      if (!isMovieOrOva && totalEps > 20 && (i % 7 === 0 || (i >= Math.floor(totalEps * 0.6) && i <= Math.floor(totalEps * 0.8)))) {
        status = 'filler';
        label = 'Relleno / Omitible';
      } else if (!isMovieOrOva && i % 5 === 0) {
        status = 'mixed';
        label = 'Mixto (Canon + Relleno)';
      }

      episodes.push({
        number: i,
        title: totalEps === 1 ? selectedSeasonForEpisodes.title : `Episodio ${i} - ${selectedSeasonForEpisodes.title}`,
        status,
        label
      });
    }

    if (hideFillerInModal) {
      return episodes.filter(ep => ep.status !== 'filler');
    }

    return episodes;
  }, [selectedSeasonForEpisodes, hideFillerInModal]);

  const RenderCanonBadge = ({ status }) => {
    switch (status) {
      case 'canon':
        return (
          <span className="flex items-center gap-1 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-md bg-emerald-950/80 text-emerald-400 border border-emerald-800">
            <ShieldCheck size={12} /> Canon
          </span>
        );
      case 'mixed':
        return (
          <span className="flex items-center gap-1 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-md bg-amber-950/80 text-amber-400 border border-amber-800">
            <AlertCircle size={12} /> Especial / Mixto
          </span>
        );
      case 'filler':
        return (
          <span className="flex items-center gap-1 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-md bg-rose-950/80 text-rose-400 border border-rose-800">
            <PlayCircle size={12} /> Relleno
          </span>
        );
      default:
        return null;
    }
  };

  const featuredAnime = catalogAnimes[0];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      
      <AuthModal 
        isOpen={isAuthModalOpen} 
        onClose={() => setIsAuthModalOpen(false)} 
        onAuthSuccess={(usr) => {
          setUser(usr);
          const metaName = usr.user_metadata?.username;
          if (metaName) {
            setUsername(metaName);
            setEditUsernameInput(metaName);
          }
          fetchUserProfile(usr.id);
        }}
      />

      {/* NAVBAR */}
      <header className="border-b border-slate-800/80 bg-slate-950/90 backdrop-blur sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          
          <div className="flex items-center gap-8">
            <button 
              onClick={goHome}
              className="flex items-center gap-3 text-left focus:outline-none group"
            >
              <div className="p-2.5 bg-gradient-to-tr from-purple-600 to-indigo-500 rounded-xl text-white font-black text-lg shadow-lg shadow-purple-900/40 group-hover:scale-105 transition-transform">
                AC
              </div>
              <div>
                <h1 className="font-extrabold text-lg bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                  AnimeCanon
                </h1>
                <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">
                  Orden Cronológico & Canon
                </span>
              </div>
            </button>

            <nav className="hidden md:flex items-center gap-1">
              <button
                onClick={goHome}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                  view === 'home' && !activeSagaId && selectedGenre === 'Todos'
                    ? 'text-white bg-purple-950/60 border border-purple-800/80'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                }`}
              >
                <Home size={15} />
                Inicio
              </button>

              <div className="relative">
                <button
                  onClick={() => setIsGenreMenuOpen(!isGenreMenuOpen)}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                    selectedGenre !== 'Todos'
                      ? 'text-purple-300 bg-purple-950/60 border border-purple-800/80'
                      : 'text-slate-400 hover:text-white hover:bg-slate-900'
                  }`}
                >
                  <Compass size={15} />
                  Género {selectedGenre !== 'Todos' && `: ${selectedGenre}`}
                  <ChevronDown size={14} className={`transition-transform ${isGenreMenuOpen ? 'rotate-180' : ''}`} />
                </button>

                {isGenreMenuOpen && (
                  <div className="absolute top-full left-0 mt-2 w-48 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl py-2 z-50 backdrop-blur-lg">
                    {GENRES_LIST.map((genre) => (
                      <button
                        key={genre}
                        onClick={() => {
                          setSelectedGenre(genre);
                          setIsGenreMenuOpen(false);
                          setActiveSagaId(null);
                          setView('home');
                        }}
                        className={`w-full text-left px-4 py-2 text-xs font-bold transition-colors ${
                          selectedGenre === genre
                            ? 'text-purple-400 bg-purple-950/40'
                            : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                        }`}
                      >
                        {genre}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <button
                onClick={() => {
                  setView('forum');
                  setActiveSagaId(null);
                }}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                  view === 'forum'
                    ? 'text-white bg-purple-950/60 border border-purple-800/80'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                }`}
              >
                <MessageSquare size={15} />
                Foro
              </button>
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-purple-900/40 transition-all"
            >
              <Globe size={15} />
              Buscar Saga
            </button>

            {user ? (
              <button 
                onClick={() => {
                  setView('profile');
                  setActiveSagaId(null);
                }}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl border transition-all ${
                  view === 'profile'
                    ? 'bg-purple-950/80 border-purple-500 text-white'
                    : 'bg-slate-900 border-slate-800 hover:border-slate-700 text-slate-200'
                }`}
              >
                <User size={15} className="text-purple-400" />
                <span className="text-xs font-bold truncate max-w-[140px] sm:max-w-xs">
                  {username || user.user_metadata?.username || user.email?.split('@')[0]}
                </span>
              </button>
            ) : (
              <button
                onClick={() => setIsAuthModalOpen(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 rounded-xl text-xs font-bold"
              >
                <User size={15} /> Cuenta
              </button>
            )}

            {activeSagaId && (
              <button
                onClick={goHome}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 rounded-xl text-xs font-bold"
              >
                <ArrowLeft size={15} /> Volver
              </button>
            )}
          </div>

        </div>
      </header>

      {/* VISTA MI PERFIL */}
      {view === 'profile' && !activeSagaId && (
        <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-8 space-y-8">
          <div className="bg-slate-900 border border-slate-800 p-6 sm:p-8 rounded-3xl shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />
            
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 relative z-10">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-gradient-to-tr from-purple-600 to-pink-500 rounded-2xl flex items-center justify-center text-white font-black text-2xl shadow-xl shadow-purple-950/60 border border-purple-400/30">
                  {(username || user?.email || 'U')[0].toUpperCase()}
                </div>
                <div>
                  <h2 className="text-2xl font-black text-white">
                    @{username || user?.user_metadata?.username || user?.email?.split('@')[0]}
                  </h2>
                  <p className="text-xs text-slate-400">{user?.email}</p>
                </div>
              </div>

              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-4 py-2 bg-slate-950 hover:bg-rose-950/60 text-slate-300 hover:text-rose-400 border border-slate-800 hover:border-rose-800 rounded-xl text-xs font-bold transition-all"
              >
                <LogOut size={15} /> Cerrar Sesión
              </button>
            </div>

            <form onSubmit={handleUpdateProfile} className="mt-8 pt-6 border-t border-slate-800/80 max-w-md">
              <label className="text-xs font-extrabold text-purple-400 uppercase tracking-wider block mb-2">
                Editar Nombre de Usuario
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={editUsernameInput}
                  onChange={(e) => setEditUsernameInput(e.target.value)}
                  placeholder="Tu nuevo @username..."
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
                  required
                />
                <button
                  type="submit"
                  disabled={isSavingProfile}
                  className="flex items-center gap-1.5 px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all"
                >
                  {isSavingProfile ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />} Guardar
                </button>
              </div>
              {profileSuccessMsg && (
                <p className="text-xs font-bold text-emerald-400 mt-2">{profileSuccessMsg}</p>
              )}
            </form>
          </div>

          <div>
            <h3 className="text-xl font-black text-white tracking-tight flex items-center gap-2 mb-4">
              <Award className="text-amber-400" size={20} /> Animes Terminados ({completedAnimes.length})
            </h3>

            {completedAnimes.length === 0 ? (
              <div className="text-center py-12 bg-slate-900/40 rounded-3xl border border-slate-800/60 p-6">
                <Award className="mx-auto text-slate-600 mb-3" size={32} />
                <h4 className="text-sm font-bold text-slate-300">Aún no has completado ningún anime</h4>
                <p className="text-xs text-slate-500 mt-1">Explora las sagas y marca los episodios vistos para ver tu historial completo aquí.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {completedAnimes.map((anime) => (
                  <div
                    key={anime.id}
                    onClick={() => handleOpenPresetSaga(anime.queryName || anime.title)}
                    className="group relative bg-slate-900 rounded-2xl overflow-hidden border border-slate-800 hover:border-purple-500 cursor-pointer transition-all hover:-translate-y-1 shadow-lg"
                  >
                    <div className="relative aspect-[3/4] overflow-hidden bg-slate-950">
                      <img
                        src={anime.cover}
                        alt={anime.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent opacity-90" />
                      <div className="absolute top-2 right-2 bg-emerald-950/90 text-emerald-300 border border-emerald-800 px-2 py-0.5 rounded-lg text-[10px] font-black flex items-center gap-1 shadow-lg">
                        <CheckCircle2 size={11} /> COMPLETADO
                      </div>
                    </div>
                    <div className="p-3">
                      <span className="text-[9px] font-bold text-purple-400 uppercase block tracking-wider truncate">
                        {anime.subtitle || 'Saga'}
                      </span>
                      <h4 className="font-extrabold text-xs text-white truncate mt-0.5">
                        {anime.title}
                      </h4>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>
      )}

      {/* MODAL EPISODIOS */}
      {selectedSeasonForEpisodes && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-3xl rounded-3xl p-6 shadow-2xl flex flex-col max-h-[85vh]">
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-800">
              <div>
                <span className="text-[10px] font-bold text-purple-400 uppercase tracking-widest block">
                  Desglose de Capítulos ({selectedSeasonForEpisodes.type})
                </span>
                <h3 className="font-black text-xl text-white">{selectedSeasonForEpisodes.title}</h3>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => setHideFillerInModal(!hideFillerInModal)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                    hideFillerInModal 
                      ? 'bg-purple-950 text-purple-300 border-purple-800' 
                      : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                  }`}
                >
                  <EyeOff size={14} />
                  {hideFillerInModal ? 'Mostrando Solo Canon' : 'Omitir Capítulos Relleno'}
                </button>

                <button 
                  onClick={() => setSelectedSeasonForEpisodes(null)}
                  className="p-2 hover:bg-slate-800 rounded-xl text-slate-400 hover:text-white transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2.5 pr-2">
              {seasonEpisodesList.length === 0 ? (
                <p className="text-center text-xs text-slate-500 py-10">Todos los episodios de esta entrega eran relleno y han sido ocultados.</p>
              ) : (
                seasonEpisodesList.map((ep) => {
                  const epWatchedKey = `${selectedSeasonForEpisodes.id}-ep-${ep.number}`;
                  const isEpWatched = watchedList.includes(epWatchedKey);

                  return (
                    <div 
                      key={ep.number}
                      className={`flex items-center justify-between p-3.5 rounded-2xl border transition-all ${
                        isEpWatched ? 'bg-slate-950/40 border-emerald-950 opacity-60' : 'bg-slate-950/80 border-slate-800/80 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-4 min-w-0">
                        <span className="font-mono font-black text-sm text-purple-400 w-8 text-right">
                          #{ep.number}
                        </span>
                        <div className="min-w-0">
                          <h4 className="font-bold text-xs sm:text-sm text-white truncate">{ep.title}</h4>
                          <div className="mt-1">
                            <RenderCanonBadge status={ep.status} />
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => toggleWatched(epWatchedKey, currentSaga)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                          isEpWatched 
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' 
                            : 'bg-slate-800 hover:bg-purple-600 text-slate-200'
                        }`}
                      >
                        {isEpWatched ? <CheckCircle2 size={14} /> : <Circle size={14} />}
                        {isEpWatched ? 'Visto' : 'Marcar'}
                      </button>
                    </div>
                  );
                })
              )}
            </div>

          </div>
        </div>
      )}

      {/* MODAL STREAMING AFILIADOS */}
      {selectedStreamingItem && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-3xl p-6 shadow-2xl relative">
            <button 
              onClick={() => setSelectedStreamingItem(null)}
              className="absolute top-5 right-5 p-2 hover:bg-slate-800 rounded-xl text-slate-400 hover:text-white"
            >
              <X size={18} />
            </button>

            <div className="text-center mb-6">
              <div className="w-12 h-12 bg-purple-600/20 text-purple-400 rounded-2xl flex items-center justify-center mx-auto mb-3 border border-purple-500/30">
                <Play size={24} fill="#c084fc" />
              </div>
              <h3 className="text-xl font-black text-white">¿Dónde ver este anime?</h3>
              <p className="text-xs text-slate-400 mt-1 line-clamp-1">
                {selectedStreamingItem.title}
              </p>
            </div>

            <div className="space-y-3">
              {selectedStreamingItem.streamingPlatforms.map((platform, idx) => (
                <a
                  key={idx}
                  href={`${platform.url}${platform.url.includes('?') ? '&' : '?'}aff=animecanon`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-4 rounded-2xl bg-slate-950/80 hover:bg-slate-800 border border-slate-800 hover:border-purple-500/80 transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-purple-950/60 border border-purple-800/60 flex items-center justify-center text-purple-300 font-bold text-xs">
                      {platform.site[0]}
                    </div>
                    <span className="font-extrabold text-sm text-white group-hover:text-purple-300 transition-colors">
                      {platform.site}
                    </span>
                  </div>
                  <span className="flex items-center gap-1.5 text-xs font-extrabold text-purple-400 group-hover:translate-x-1 transition-transform">
                    Ver ahora <ExternalLink size={14} />
                  </span>
                </a>
              ))}
            </div>

            <p className="text-[10px] text-slate-500 text-center mt-6">
              Plataformas oficiales legales según tu región.
            </p>
          </div>
        </div>
      )}

      {/* MODAL BÚSQUEDA SAGAS */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-2xl rounded-3xl p-6 shadow-2xl flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-black text-lg text-white flex items-center gap-2">
                <Layers className="text-purple-400" size={20} />
                Buscador de Sagas Unificadas
              </h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <div className="relative mb-4">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
              <input
                type="text"
                placeholder="Escribe el nombre de la saga (ej: Naruto, Bleach, Dragon Ball)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
                className="w-full bg-slate-950 text-slate-100 placeholder-slate-500 pl-10 pr-10 py-2.5 rounded-xl text-sm border border-slate-800 focus:outline-none focus:border-purple-500"
              />
              {isSearching && (
                <Loader2 className="absolute right-3.5 top-1/2 -translate-y-1/2 animate-spin text-purple-400" size={16} />
              )}
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {dynamicSagas.length === 0 && searchQuery.trim().length >= 2 && !isSearching && (
                <p className="text-center text-xs text-slate-500 py-8">No se encontraron sagas con ese nombre.</p>
              )}

              {dynamicSagas.map((saga) => (
                <div 
                  key={saga.id}
                  onClick={() => {
                    registerKnownAnime(saga);
                    setActiveSagaId(saga.id);
                    setIsModalOpen(false);
                    setView('home');
                  }}
                  className="flex items-center gap-4 bg-slate-950/80 hover:bg-slate-800/80 p-3.5 rounded-2xl border border-slate-800/80 hover:border-purple-500/80 cursor-pointer transition-all"
                >
                  <img src={saga.cover} alt={saga.title} className="w-14 h-20 object-cover rounded-xl border border-slate-800" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-bold bg-purple-950 text-purple-300 px-2 py-0.5 rounded border border-purple-800">
                        {saga.subtitle}
                      </span>
                      <span className="text-xs text-amber-400 font-bold flex items-center gap-1">
                        <Star size={10} fill="#fbbf24" /> {saga.rating}
                      </span>
                    </div>
                    <h4 className="font-extrabold text-sm text-white truncate">Saga {saga.title}</h4>
                    <p className="text-xs text-slate-400 line-clamp-1">{saga.description}</p>
                  </div>
                  <button className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-xl whitespace-nowrap">
                    Ver Timeline
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* VISTA DEL FORO */}
      {view === 'forum' && !activeSagaId && (
        <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-8">
          <div className="flex items-center justify-between mb-8 bg-slate-900/60 p-6 rounded-3xl border border-slate-800">
            <div>
              <span className="text-xs font-bold text-purple-400 uppercase tracking-widest block mb-1">
                Comunidad AnimeCanon
              </span>
              <h2 className="text-3xl font-black text-white tracking-tight">Foro de Discusión</h2>
              <p className="text-xs text-slate-400 mt-1">Comparte recomendaciones, debate sobre arcos canon y responde dudas a otros usuarios.</p>
            </div>

            <button
              onClick={() => {
                if (!user) {
                  setIsAuthModalOpen(true);
                } else {
                  setIsCreatingPost(!isCreatingPost);
                }
              }}
              className="flex items-center gap-2 px-5 py-3 bg-purple-600 hover:bg-purple-500 text-white font-extrabold text-xs rounded-2xl shadow-lg shadow-purple-950/80 transition-all whitespace-nowrap"
            >
              <Plus size={16} /> Crear Publicación
            </button>
          </div>

          {isCreatingPost && (
            <form onSubmit={handleCreatePost} className="bg-slate-900 border border-slate-800 rounded-3xl p-6 mb-8 space-y-4 shadow-2xl">
              <h3 className="text-lg font-black text-white mb-2">Nueva Publicación</h3>
              <div>
                <input
                  type="text"
                  placeholder="Título del tema (ej: ¿Vale la pena ver el relleno de Naruto?)..."
                  value={newPostTitle}
                  onChange={(e) => setNewPostTitle(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
                  required
                />
              </div>
              <div>
                <textarea
                  placeholder="Escribe tu mensaje o recomendación aquí..."
                  rows={4}
                  value={newPostContent}
                  onChange={(e) => setNewPostContent(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
                  required
                />
              </div>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsCreatingPost(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-2 px-5 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold"
                >
                  <Send size={14} /> Publicar
                </button>
              </div>
            </form>
          )}

          {isForumLoading ? (
            <div className="flex items-center justify-center py-20 text-purple-400 gap-3">
              <Loader2 className="animate-spin" size={24} />
              <span className="text-xs font-bold uppercase tracking-wider">Cargando discusiones...</span>
            </div>
          ) : forumPosts.length === 0 ? (
            <div className="text-center py-16 bg-slate-900/40 rounded-3xl border border-slate-800/60 p-8">
              <MessageSquare className="mx-auto text-slate-600 mb-3" size={32} />
              <h4 className="text-base font-bold text-slate-300">Aún no hay publicaciones</h4>
              <p className="text-xs text-slate-500 mt-1">¡Sé el primero en iniciar una conversación o recomendación en la comunidad!</p>
            </div>
          ) : (
            <div className="space-y-6">
              {forumPosts.map((post) => {
                const comments = postComments[post.id] || [];
                const isOwner = user && user.id === post.user_id;
                const isCommentsOpen = activeCommentsPostId === post.id;

                return (
                  <div key={post.id} className="bg-slate-900 border border-slate-800 p-6 rounded-3xl hover:border-slate-700 transition-all">
                    
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-purple-950 border border-purple-800/80 rounded-xl flex items-center justify-center text-purple-300 font-black text-xs">
                          {post.username ? post.username[0].toUpperCase() : 'U'}
                        </div>
                        <div>
                          <span className="text-xs font-bold text-white block">@{post.username}</span>
                          <span className="text-[10px] text-slate-500 block">
                            {new Date(post.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>

                      {isOwner && (
                        <button
                          onClick={() => handleDeletePost(post.id)}
                          title="Eliminar publicación"
                          className="p-2 text-slate-500 hover:text-rose-400 hover:bg-slate-800 rounded-xl transition-all"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>

                    <h3 className="text-lg font-black text-white mb-2">{post.title}</h3>
                    <p className="text-slate-300 text-xs sm:text-sm leading-relaxed whitespace-pre-line mb-4">{post.content}</p>

                    <div className="flex items-center gap-4 pt-3 border-t border-slate-800/80">
                      <button
                        onClick={() => setActiveCommentsPostId(isCommentsOpen ? null : post.id)}
                        className="flex items-center gap-2 text-xs font-extrabold text-purple-400 hover:text-purple-300 transition-colors"
                      >
                        <MessageCircle size={15} />
                        {comments.length} {comments.length === 1 ? 'Respuesta' : 'Respuestas'}
                      </button>
                    </div>

                    {isCommentsOpen && (
                      <div className="mt-4 pt-4 border-t border-slate-800/60 space-y-3 bg-slate-950/60 p-4 rounded-2xl">
                        
                        {comments.length === 0 ? (
                          <p className="text-xs text-slate-500">Aún no hay respuestas. ¡Sé el primero en opinar!</p>
                        ) : (
                          comments.map((comm) => {
                            const isCommentOwner = user && user.id === comm.user_id;

                            return (
                              <div key={comm.id} className="flex gap-3 bg-slate-900/80 border border-slate-800 p-3 rounded-xl">
                                <CornerDownRight size={14} className="text-purple-400 mt-1 flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="text-xs font-bold text-purple-300">@{comm.username}</span>
                                    {isCommentOwner && (
                                      <button
                                        onClick={() => handleDeleteComment(comm.id)}
                                        className="text-[10px] text-slate-500 hover:text-rose-400"
                                      >
                                        Eliminar
                                      </button>
                                    )}
                                  </div>
                                  <p className="text-xs text-slate-200 leading-relaxed">{comm.content}</p>
                                </div>
                              </div>
                            );
                          })
                        )}

                        <div className="flex gap-2 mt-3 pt-2">
                          <input
                            type="text"
                            placeholder={user ? "Escribe una respuesta..." : "Inicia sesión para responder"}
                            value={activeCommentsPostId === post.id ? newReplyText : ''}
                            onChange={(e) => setNewReplyText(e.target.value)}
                            disabled={!user}
                            className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 disabled:opacity-50"
                          />
                          <button
                            onClick={() => handleAddComment(post.id)}
                            disabled={!user || !newReplyText.trim()}
                            className="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1"
                          >
                            <Send size={12} /> Responder
                          </button>
                        </div>

                      </div>
                    )}

                  </div>
                );
              })}
            </div>
          )}
        </main>
      )}

      {/* VISTA 1: PORTADA PRINCIPAL */}
      {view === 'home' && !activeSagaId && (
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-8">
          
          {featuredAnime && (
            <div className="relative rounded-3xl overflow-hidden border border-slate-800 bg-slate-900 p-8 sm:p-14 mb-12 shadow-2xl">
              <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/80 to-transparent z-10" />
              <img 
                src={featuredAnime.banner || featuredAnime.cover} 
                alt={featuredAnime.title} 
                className="absolute inset-0 w-full h-full object-cover opacity-35 scale-105" 
              />
              
              <div className="relative z-20 max-w-xl">
                <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest bg-amber-500/20 text-amber-400 border border-amber-500/30 px-3 py-1 rounded-full w-max mb-4">
                  <Flame size={13} /> Anime Popular Destacado
                </span>
                <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight mb-3 line-clamp-2">
                  {featuredAnime.title}
                </h2>
                <p className="text-slate-300 text-xs sm:text-sm leading-relaxed mb-6 line-clamp-3">
                  {featuredAnime.description}
                </p>
                
                <button 
                  onClick={() => handleOpenPresetSaga(featuredAnime.queryName || featuredAnime.title)} 
                  className="flex items-center gap-2 px-6 py-3.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-extrabold rounded-2xl shadow-xl shadow-purple-950/80 hover:scale-105 transition-all"
                >
                  <Play size={16} fill="white" /> EXPLORAR SAGA COMPLETA & CANON
                </button>
              </div>
            </div>
          )}

          {isCatalogLoading ? (
            <div className="flex items-center justify-center py-20 text-purple-400 gap-3">
              <Loader2 className="animate-spin" size={24} />
              <span className="text-xs font-bold uppercase tracking-wider">Cargando portadas desde AniList...</span>
            </div>
          ) : (
            <>
              <AnimeRow 
                title="Continuar Viendo" 
                icon={Clock} 
                items={continuingAnimes} 
                onSelectAnime={handleOpenPresetSaga}
                myList={myList}
                onToggleList={toggleMyList}
                emptyMessage="Aún no has empezado a ver ninguna saga. Entra a una y marca temporadas o episodios para verlos aquí."
              />

              <AnimeRow 
                title="Mi Lista" 
                icon={Bookmark} 
                items={myListAnimes} 
                onSelectAnime={handleOpenPresetSaga}
                myList={myList}
                onToggleList={toggleMyList}
                emptyMessage="Tu lista está vacía. Pasa el cursor por encima de cualquier anime y haz clic en el botón '+' para guardarlo."
              />

              <AnimeRow 
                title="Tendencias & Populares" 
                icon={Flame} 
                items={trendingAnimes} 
                onSelectAnime={handleOpenPresetSaga} 
                myList={myList}
                onToggleList={toggleMyList}
              />

              <AnimeRow 
                title="Lo Más Nuevo / En Emisión" 
                icon={Sparkles} 
                items={newestAnimes} 
                onSelectAnime={handleOpenPresetSaga} 
                myList={myList}
                onToggleList={toggleMyList}
              />

              <AnimeRow 
                title={selectedGenre === 'Todos' ? 'Recomendados de la Comunidad' : `Recomendados de ${selectedGenre}`} 
                icon={Star} 
                items={catalogAnimes} 
                onSelectAnime={handleOpenPresetSaga} 
                myList={myList}
                onToggleList={toggleMyList}
              />
            </>
          )}

        </main>
      )}

      {/* VISTA 2: TIMELINE DE SAGA */}
      {activeSagaId && currentSaga && (
        <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-8">
          
          <div className="bg-slate-900/60 p-6 rounded-3xl border border-slate-800 mb-8 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <span className="text-xs font-bold text-purple-400 uppercase tracking-widest block mb-1">
                  Saga Unificada • {sortedItems.length} Entregas
                </span>
                
                <div className="flex items-center gap-3">
                  <h2 className="text-3xl font-black text-white tracking-tight">
                    Saga {currentSaga.title}
                  </h2>
                  
                  <button
                    onClick={() => toggleMyList(currentSaga)}
                    title={myList.includes(currentSaga.id) ? "Quitar de mi lista" : "Añadir a mi lista"}
                    className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${
                      myList.includes(currentSaga.id)
                        ? 'bg-emerald-600 text-white border border-emerald-400 shadow-lg shadow-emerald-950'
                        : 'bg-slate-800 hover:bg-purple-600 text-slate-200 border border-slate-700'
                    }`}
                  >
                    {myList.includes(currentSaga.id) ? <Check size={18} /> : <Plus size={20} />}
                  </button>
                </div>

                <p className="text-xs text-slate-400 mt-1 line-clamp-2">{currentSaga.description}</p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => setHideFillerInSaga(!hideFillerInSaga)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold border transition-all ${
                    hideFillerInSaga 
                      ? 'bg-purple-950 text-purple-300 border-purple-800' 
                      : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                  }`}
                >
                  <EyeOff size={15} />
                  {hideFillerInSaga ? 'Ocultando Relleno/OVAs' : 'Filtrar Solo Canon'}
                </button>

                {sagaProgressPercent === 100 && (
                  <div className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-950 text-emerald-400 border border-emerald-800 rounded-2xl text-xs font-black uppercase tracking-wider shadow-lg shadow-emerald-950/50">
                    <Award size={16} /> ¡Saga Completada!
                  </div>
                )}
              </div>
            </div>

            <div className="pt-2 border-t border-slate-800/80">
              <div className="flex items-center justify-between text-xs font-bold mb-1.5">
                <span className="text-slate-400">Progreso de Vistas de la Saga</span>
                <span className={sagaProgressPercent === 100 ? "text-emerald-400" : "text-purple-400"}>
                  {sagaProgressPercent}% completado
                </span>
              </div>
              <div className="w-full bg-slate-950 h-3 rounded-full overflow-hidden border border-slate-800/80 p-0.5">
                <div 
                  className={`h-full rounded-full transition-all duration-500 ${
                    sagaProgressPercent === 100 
                      ? 'bg-gradient-to-r from-emerald-500 to-teal-400 shadow-lg shadow-emerald-500/50' 
                      : 'bg-gradient-to-r from-purple-600 to-indigo-500 shadow-lg shadow-purple-600/50'
                  }`}
                  style={{ width: `${sagaProgressPercent}%` }}
                />
              </div>
            </div>

          </div>

          <div className="relative border-l-2 border-purple-900/30 ml-4 sm:ml-32 space-y-6 my-6">
            {sortedItems.map((item, index) => {
              const isSeasonWatched = watchedList.includes(item.id);

              return (
                <div key={item.id} className="relative pl-6 sm:pl-8 group">
                  <div className={`absolute -left-[9px] top-4 w-4 h-4 rounded-full border-2 transition-all ${
                    isSeasonWatched ? 'bg-emerald-500 border-emerald-300' : 'bg-slate-950 border-purple-500'
                  }`} />

                  <div className="hidden sm:block absolute -left-28 top-3 text-right w-20 font-mono text-xs font-semibold text-slate-500">
                    <span className="text-purple-400 font-bold">#{index + 1}</span>
                    <span className="block text-[11px] text-slate-600">{item.year}</span>
                  </div>

                  <div className={`p-5 rounded-2xl border transition-all ${
                    isSeasonWatched ? 'bg-slate-900/40 border-emerald-900/30 opacity-75' : 'bg-slate-900 border-slate-800 shadow-xl'
                  }`}>
                    <div className="flex flex-col sm:flex-row gap-5">
                      <img src={item.cover} alt={item.title} className="w-full sm:w-32 h-44 object-cover rounded-xl border border-slate-800 shadow-md" />
                      
                      <div className="flex-1 flex flex-col justify-between">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap mb-2">
                            <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-md border bg-slate-950 text-purple-300 border-purple-800">
                              {item.type} • {item.episodes}
                            </span>
                            <span className="text-[10px] text-slate-400 font-semibold">
                              Estreno: {item.year}
                            </span>
                          </div>

                          <h3 className="text-xl font-bold text-white mb-2">{item.title}</h3>
                          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">{item.description}</p>
                        </div>

                        <div className="flex items-center justify-between gap-3 mt-4 pt-3 border-t border-slate-800/80 flex-wrap">
                          <button 
                            onClick={() => setSelectedSeasonForEpisodes(item)}
                            className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-purple-950/40"
                          >
                            <ListOrdered size={15} /> Ver Episodios & Canon
                          </button>

                          <button 
                            onClick={() => toggleWatched(item.id, currentSaga)}
                            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                              isSeasonWatched
                                ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                            }`}
                          >
                            {isSeasonWatched ? <CheckCircle2 size={14} /> : <Circle size={14} />}
                            {isSeasonWatched ? 'Temporada Vista' : 'Marcar Vista'}
                          </button>

                          <button 
                            onClick={() => setSelectedStreamingItem(item)}
                            className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-extrabold rounded-xl transition-all shadow-md shadow-purple-950/40"
                          >
                            <Play size={13} fill="white" /> Ver Anime
                          </button>
                        </div>

                      </div>
                    </div>
                  </div>

                </div>
              );
            })}
          </div>
        </main>
      )}

    </div>
  );
}