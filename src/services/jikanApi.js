// src/services/jikanApi.js

// 1. Obtener animes populares agrupados por franquicia (con soporte para filtro por género)
export async function fetchPopularAnimesByGenre(genre = 'Todos') {
  const query = `
    query ($genre: String) {
      Page(page: 1, perPage: 50) {
        media(type: ANIME, sort: POPULARITY_DESC, genre: $genre, isAdult: false) {
          id
          title {
            romaji
            english
          }
          coverImage {
            extraLarge
            large
          }
          bannerImage
          averageScore
          genres
          description(asHtml: false)
        }
      }
    }
  `;

  const variables = genre && genre !== 'Todos' ? { genre } : {};

  try {
    const response = await fetch('https://graphql.anilist.co', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables })
    });
    const data = await response.json();
    let list = data?.data?.Page?.media || [];

    if (genre && genre !== 'Todos') {
      list = list.filter(item => {
        const topGenres = item.genres?.slice(0, 2) || [];
        return topGenres.includes(genre);
      });
    }

    const seenFranchises = new Set();
    const uniqueSagas = [];

    for (const item of list) {
      const rawTitle = item.title.english || item.title.romaji;
      
      const baseTitle = rawTitle
        .replace(/(Season\s*\d+|Part\s*\d+|The Final Season|2nd Season|3rd Season|4th Season|Cour\s*\d+|:.*)/i, '')
        .trim();

      const franchiseKey = baseTitle.toLowerCase();

      if (!seenFranchises.has(franchiseKey)) {
        seenFranchises.add(franchiseKey);
        uniqueSagas.push({
          id: `anilist-${item.id}`,
          queryName: baseTitle,
          title: baseTitle,
          subtitle: item.genres?.slice(0, 2).join(' • ') || 'Anime',
          cover: item.coverImage?.extraLarge || item.coverImage?.large,
          banner: item.bannerImage || item.coverImage?.extraLarge,
          rating: item.averageScore ? (item.averageScore / 10).toFixed(1) : '8.0',
          description: item.description ? item.description.replace(/<[^>]*>?/gm, '') : 'Sin descripción disponible.'
        });
      }
    }

    return uniqueSagas.slice(0, 24);
  } catch (err) {
    console.error('Error al obtener animes populares:', err);
    return [];
  }
}

// 2. Animes en Tendencia / Más Populares para la fila de carrusel
export async function fetchTrendingAnimes() {
  const query = `
    query {
      Page(page: 1, perPage: 15) {
        media(type: ANIME, sort: TRENDING_DESC, isAdult: false) {
          id
          title { romaji english }
          coverImage { extraLarge large }
          averageScore
          genres
          description(asHtml: false)
        }
      }
    }
  `;
  try {
    const res = await fetch('https://graphql.anilist.co', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query })
    });
    const data = await res.json();
    return formatMediaList(data?.data?.Page?.media || []);
  } catch (err) {
    console.error('Error fetching trending:', err);
    return [];
  }
}

// 3. Lo Más Nuevo / Últimos Estrenos para la fila de carrusel
export async function fetchNewestAnimes() {
  const query = `
    query {
      Page(page: 1, perPage: 15) {
        media(type: ANIME, sort: START_DATE_DESC, status: RELEASING, isAdult: false) {
          id
          title { romaji english }
          coverImage { extraLarge large }
          averageScore
          genres
          description(asHtml: false)
        }
      }
    }
  `;
  try {
    const res = await fetch('https://graphql.anilist.co', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query })
    });
    const data = await res.json();
    return formatMediaList(data?.data?.Page?.media || []);
  } catch (err) {
    console.error('Error fetching newest:', err);
    return [];
  }
}

// Helper interno para formatear las listas de los carruseles
function formatMediaList(mediaList) {
  const seen = new Set();
  const formatted = [];

  for (const item of mediaList) {
    const rawTitle = item.title.english || item.title.romaji;
    const baseTitle = rawTitle.replace(/(Season\s*\d+|Part\s*\d+|The Final Season|2nd Season|3rd Season|4th Season|Cour\s*\d+|:.*)/i, '').trim();
    const key = baseTitle.toLowerCase();

    if (!seen.has(key)) {
      seen.add(key);
      formatted.push({
        id: `anilist-${item.id}`,
        queryName: baseTitle,
        title: baseTitle,
        subtitle: item.genres?.slice(0, 2).join(' • ') || 'Anime',
        cover: item.coverImage?.extraLarge || item.coverImage?.large,
        rating: item.averageScore ? (item.averageScore / 10).toFixed(1) : '8.0',
        description: item.description ? item.description.replace(/<[^>]*>?/gm, '') : ''
      });
    }
  }
  return formatted;
}

// 4. Buscar saga completa unificada (FILTRADO POR TOKENS Y RELEVANCIA)
export async function searchSagasFromAniList(queryText) {
  const query = `
    query ($search: String) {
      Page(page: 1, perPage: 25) {
        media(search: $search, type: ANIME, sort: [SEARCH_MATCH, POPULARITY_DESC], isAdult: false) {
          id
          title {
            romaji
            english
            native
          }
          coverImage {
            extraLarge
            large
          }
          bannerImage
          averageScore
          popularity
          genres
          description(asHtml: false)
          startDate { year month day }
          episodes
          format
          status
          externalLinks {
            id
            url
            site
            icon
            color
          }
        }
      }
    }
  `;

  try {
    const response = await fetch('https://graphql.anilist.co', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables: { search: queryText } })
    });
    const data = await response.json();
    let mediaList = data?.data?.Page?.media || [];

    if (mediaList.length === 0) return [];

    // Tokens de búsqueda limpios
    const cleanQuery = queryText.toLowerCase().trim();
    const queryTokens = cleanQuery.split(' ').filter(t => t.length > 1);

    // 1. Filtrar resultados que NO tengan relación directa con las palabras buscadas
    let filteredList = mediaList.filter(item => {
      const titleEng = (item.title.english || '').toLowerCase();
      const titleRom = (item.title.romaji || '').toLowerCase();
      const combined = `${titleEng} ${titleRom}`;

      // Descartar comerciales conocidos y promos de marcas
      if (item.format === 'CM' || combined.includes('suntory') || combined.includes('commercial')) {
        return false;
      }

      // Debe coincidir al menos con la mayoría de las palabras buscadas
      if (queryTokens.length > 0) {
        const matchesToken = queryTokens.every(token => combined.includes(token));
        return matchesToken;
      }

      return true;
    });

    // Si el filtro por tokens es muy estricto y se queda vacío, respaldar con los top populares
    if (filteredList.length === 0) {
      filteredList = [mediaList[0]];
    }

    // 2. Ordenar por relevancia: Priorizar mayor Popularidad y Score
    filteredList.sort((a, b) => {
      const scoreA = (a.averageScore || 0) + (a.popularity ? a.popularity / 1000 : 0);
      const scoreB = (b.averageScore || 0) + (b.popularity ? b.popularity / 1000 : 0);
      return scoreB - scoreA;
    });

    const mainMedia = filteredList[0];
    const baseTitle = (mainMedia.title.english || mainMedia.title.romaji)
      .replace(/(Season\s*\d+|Part\s*\d+|The Final Season|2nd Season|3rd Season|4th Season|Cour\s*\d+|Movie|:.*)/i, '')
      .trim();

    const formattedItems = filteredList.map((item) => {
      const streamingPlatforms = (item.externalLinks || []).filter(link => 
        ['Crunchyroll', 'Netflix', 'Amazon', 'Hulu', 'Disney+', 'Funimation', 'Anime Onegai'].some(s => 
          link.site.toLowerCase().includes(s.toLowerCase())
        )
      );

      const year = item.startDate?.year || 9999;
      const month = item.startDate?.month || 12;
      const day = item.startDate?.day || 31;

      return {
        id: `anilist-${item.id}`,
        title: item.title.english || item.title.romaji,
        type: item.format || 'TV',
        episodes: item.episodes ? `${item.episodes} EPS` : (item.status === 'NOT_YET_RELEASED' ? 'Por estrenar' : '1 EP'),
        episodesCount: item.episodes || 1,
        year: year !== 9999 ? year : 'Próximamente',
        rawDateValue: year * 10000 + month * 100 + day,
        description: item.description ? item.description.replace(/<[^>]*>?/gm, '') : 'Sin descripción disponible.',
        cover: item.coverImage?.extraLarge || item.coverImage?.large,
        streamingPlatforms: streamingPlatforms.length > 0 ? streamingPlatforms : [
          { site: 'Crunchyroll', url: `https://www.crunchyroll.com/search?q=${encodeURIComponent(item.title.romaji)}` },
          { site: 'Netflix', url: `https://www.netflix.com/search?q=${encodeURIComponent(item.title.romaji)}` }
        ]
      };
    });

    return [{
      id: `saga-${mainMedia.id}`,
      title: baseTitle,
      subtitle: mainMedia.genres?.slice(0, 2).join(' • ') || 'Anime',
      cover: mainMedia.coverImage?.extraLarge || mainMedia.coverImage?.large,
      rating: mainMedia.averageScore ? (mainMedia.averageScore / 10).toFixed(1) : '8.0',
      description: mainMedia.description ? mainMedia.description.replace(/<[^>]*>?/gm, '') : '',
      items: formattedItems
    }];
  } catch (err) {
    console.error('Error al buscar saga:', err);
    return [];
  }
}