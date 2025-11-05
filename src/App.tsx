import { useState, useEffect, useRef, useCallback } from 'react';
import './index.css';
import { SearchHistoryDropdown } from './components/SearchHistoryDropdown';
import { AppService, AppWithDetails } from './services/appService';

// Utility function to copy image as PNG
const copyImageAsPng = async (imgOrSrc: HTMLImageElement | string): Promise<'copied' | 'downloaded'> => {
  try {
    const img = typeof imgOrSrc === 'string' ? new Image() : imgOrSrc;
    
    if (typeof imgOrSrc === 'string') {
      img.crossOrigin = 'anonymous';
      img.src = imgOrSrc;
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });
    }

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas context not available');

    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    ctx.drawImage(img, 0, 0);

    const blob = await new Promise<Blob>((resolve) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else throw new Error('Failed to create blob');
      }, 'image/png');
    });

    // Try to copy to clipboard
    if (navigator.clipboard && window.ClipboardItem) {
      try {
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': blob })
        ]);
        return 'copied';
      } catch (clipboardError) {
        console.warn('Clipboard API failed, falling back to download:', clipboardError);
      }
    }

    // Fallback to download
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'app-logo.png';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    return 'downloaded';
  } catch (error) {
    console.error('Error copying image:', error);
    throw error;
  }
};

// Draw a rounded rectangle path on canvas
const addRoundedRectPath = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) => {
  const r = Math.max(0, Math.min(radius, Math.min(width, height) / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
};

// Get border-radius as a ratio (0..1) from an element's computed style
const getBorderRadiusRatio = (el: HTMLElement): number => {
  const style = getComputedStyle(el);
  const br = style.borderTopLeftRadius || style.borderRadius || '0';
  const first = br.split('/')[0].trim().split(' ')[0];
  const rect = el.getBoundingClientRect();
  const base = Math.min(rect.width || 0, rect.height || 0) || 1;
  if (first.endsWith('%')) {
    const pct = parseFloat(first) || 0;
    return Math.max(0, Math.min(1, pct / 100));
  }
  const px = parseFloat(first) || 0;
  return Math.max(0, Math.min(1, px / base));
};

// Copy a single image preserving its border-radius
  const copySingleImageWithRadius = async (imgEl: HTMLImageElement): Promise<'copied' | 'downloaded'> => {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas context not available');

  if (!imgEl.complete || imgEl.naturalWidth === 0) {
    await new Promise((resolve, reject) => {
      imgEl.onload = resolve as any;
      imgEl.onerror = reject as any;
    });
  }

  canvas.width = imgEl.naturalWidth;
  canvas.height = imgEl.naturalHeight;
  const ratio = getBorderRadiusRatio(imgEl);
  const radius = ratio * Math.min(canvas.width, canvas.height);

  addRoundedRectPath(ctx, 0, 0, canvas.width, canvas.height, radius);
  ctx.clip();
  ctx.drawImage(imgEl, 0, 0, canvas.width, canvas.height);

  const blob: Blob = await new Promise((resolve, reject) => {
    try {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Failed to create blob'))), 'image/png');
    } catch (err) {
      reject(err);
    }
  });

  if (navigator.clipboard && (window as any).ClipboardItem) {
    try {
      await navigator.clipboard.write([
        new (window as any).ClipboardItem({ 'image/png': blob })
      ]);
      return 'copied';
    } catch (err) {
      console.warn('Clipboard API failed, falling back to download:', err);
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'app-logo.png';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return 'downloaded';
};

// Create a combined canvas from multiple images, preserving aspect ratio and border-radius
const generateCombinedCanvas = async (
  images: HTMLImageElement[],
  options?: { cellSize?: number; gap?: number }
): Promise<HTMLCanvasElement> => {
  const ready = await Promise.all(
    images.map((img) => {
      if (img.complete && img.naturalWidth > 0) return Promise.resolve(img);
      return new Promise<HTMLImageElement>((resolve, reject) => {
        img.onload = () => resolve(img);
        img.onerror = reject as any;
      });
    })
  );

  const n = ready.length;
  const cols = Math.ceil(Math.sqrt(n));
  const rows = Math.ceil(n / cols);
  const cell = options?.cellSize ?? 512;
  const gap = options?.gap ?? Math.round(cell * 0.06);

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas context not available');

  canvas.width = cols * cell + (cols + 1) * gap;
  canvas.height = rows * cell + (rows + 1) * gap;

  ctx.save();
  for (let i = 0; i < n; i++) {
    const img = ready[i];
    const col = i % cols;
    const row = Math.floor(i / cols);
    const tileX = gap + col * (cell + gap);
    const tileY = gap + row * (cell + gap);

    const aspect = img.naturalWidth / img.naturalHeight;
    let drawW = cell;
    let drawH = cell;
    if (aspect > 1) {
      drawH = Math.round(cell / aspect);
    } else if (aspect < 1) {
      drawW = Math.round(cell * aspect);
    }
    const dx = tileX + Math.round((cell - drawW) / 2);
    const dy = tileY + Math.round((cell - drawH) / 2);

    const ratio = getBorderRadiusRatio(img);
    const radius = ratio * Math.min(drawW, drawH);

    ctx.save();
    addRoundedRectPath(ctx, dx, dy, drawW, drawH, radius);
    ctx.clip();
    ctx.drawImage(img, dx, dy, drawW, drawH);
    ctx.restore();
  }
  ctx.restore();

  return canvas;
};

// Color categories for filtering
const COLORS = [
  { id: 'all', name: 'All Colors', value: 'all' },
  { id: 'red', name: 'Red', value: '#ff0000' },
  { id: 'orange', name: 'Orange', value: '#ffa500' },
  { id: 'yellow', name: 'Yellow', value: '#ffff00' },
  { id: 'green', name: 'Green', value: '#00ff00' },
  { id: 'blue', name: 'Blue', value: '#0000ff' },
  { id: 'purple', name: 'Purple', value: '#800080' },
  { id: 'pink', name: 'Pink', value: '#ff1493' },
  { id: 'black', name: 'Black', value: '#000000' },
  { id: 'white', name: 'White', value: '#ffffff' }
];

function App() {
  const [apps, setApps] = useState<AppWithDetails[]>([]);
  const [selectedColor, setSelectedColor] = useState<string>('all');
  const [totalAppCount, setTotalAppCount] = useState<number>(0);
  const [selectedCategory, setSelectedCategory] = useState<'app' | 'game'>('app');

  const [searchTerm, setSearchTerm] = useState('');
  const [hasSearched, setHasSearched] = useState(false);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [isSearchHistoryOpen, setIsSearchHistoryOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [copyStatus, setCopyStatus] = useState<{ [key: string]: string }>({});
  const imgRefs = useRef<Map<string, HTMLImageElement>>(new Map());
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [globalMessage, setGlobalMessage] = useState<string | null>(null);
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null);
  const [imageLoaded, setImageLoaded] = useState<{ [key: string]: boolean }>({});

  const handleImageLoad = useCallback((id: string) => {
    setImageLoaded(prev => ({ ...prev, [id]: true }));
  }, []);

  const handleImageError = useCallback((id: string) => {
    // Hide skeleton even if the image fails to load to avoid a stuck placeholder
    setImageLoaded(prev => ({ ...prev, [id]: true }));
  }, []);

  const loadAppsByCategory = useCallback(async () => {
    try {
      setIsLoading(true);
      const appsFromDb = await AppService.getAppsByCategory([selectedCategory]);

      // Set total count from database (this is the "flex" number)
      setTotalAppCount(appsFromDb.length);

      if (appsFromDb.length === 0) {
        setApps([]);
        return;
      }

      // Get app store IDs for iTunes API lookup
      const appStoreIds = appsFromDb.map(app => app.app_store_id);

      // Fetch app details from iTunes API
      const appDetails = await AppService.getAppDetails(appStoreIds);

      // Map the data and sort by name
      const allApps = appDetails
        .map(app => {
          const dbApp = appsFromDb.find(dbApp => dbApp.app_store_id === app.trackId.toString());
          return {
            ...app,
            trackName: dbApp ? dbApp.name : app.trackName
          };
        })
        .sort((a, b) => a.trackName.localeCompare(b.trackName));

      // Extract dominant colors for each app
      const appsWithColors = await Promise.all(
        allApps.map(async (app) => {
          try {
            const color = await AppService.getDominantColor(app.artworkUrl100);
            return { ...app, dominantColor: color };
          } catch (error) {
            console.error('Error getting dominant color for', app.trackName, error);
            return { ...app, dominantColor: '#666666' }; // Fallback color
          }
        })
      );

      setApps(appsWithColors);
    } catch (error) {
      console.error('Error loading apps by category:', error);
    } finally {
      setIsLoading(false);
    }
  }, [selectedCategory]);

  useEffect(() => {
    loadAppsByCategory();
  }, [loadAppsByCategory]);

  // Color distance helper and closest palette color
  // Hue-based color matching for perceptual accuracy
  function hexToHsl(hex: string): { h: number; s: number; l: number } | null {
    const res = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!res) return null;
    let r = parseInt(res[1], 16) / 255;
    let g = parseInt(res[2], 16) / 255;
    let b = parseInt(res[3], 16) / 255;

    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0;
    const l = (max + min) / 2;
    const d = max - min;
    if (d !== 0) {
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h *= 60;
    }
    return { h, s, l };
  }

  function hueDistance(a: number, b: number): number {
    const d = Math.abs(a - b) % 360;
    return d > 180 ? 360 - d : d;
  }

  function getClosestColorId(color: string): string {
    const hsl = hexToHsl(color);
    if (!hsl) return 'black';

    // Handle neutrals by lightness/saturation thresholds
    if (hsl.s < 0.12) {
      return hsl.l > 0.8 ? 'white' : 'black';
    }

    const paletteWithHues = COLORS.filter(c => c.id !== 'all' && c.id !== 'white' && c.id !== 'black')
      .map(c => ({ id: c.id, h: hexToHsl(c.value)!.h }));
    const closest = paletteWithHues
      .map(p => ({ id: p.id, dist: hueDistance(hsl.h, p.h) }))
      .sort((a, b) => a.dist - b.dist)[0];

    // Edge-case: decide between black/white vs chroma if saturation very low
    return closest?.id || 'black';
  }

  // Derived lists (filter, paginate)
  const filteredApps: AppWithDetails[] = apps
    .filter(app => {
      if (selectedColor === 'all') return true;
      const closest = getClosestColorId(app.dominantColor || '#666666');
      return closest === selectedColor;
    })
    .sort((a, b) => a.trackName.localeCompare(b.trackName));

  const displayedApps: AppWithDetails[] = filteredApps;

  // Flat list rendering; categories removed


  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = (document.activeElement?.tagName || '').toLowerCase();
      const isTyping = activeTag === 'input' || activeTag === 'textarea';
      if (e.key === 'Escape') {
        setCopyStatus({});
        setSelectedIds([]);
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a' && !isTyping) {
        e.preventDefault();
        setSelectedIds(displayedApps.map(a => a.trackId.toString()));
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [displayedApps]);

  useEffect(() => {
    const run = async () => {
      if (selectedIds.length === 0) {
        setPreviewDataUrl(null);
        return;
      }
      try {
        const imgs: HTMLImageElement[] = selectedIds
          .map(id => imgRefs.current.get(id))
          .filter((el): el is HTMLImageElement => !!el);
        if (imgs.length === 0) return;
        const canvas = await generateCombinedCanvas(imgs, { cellSize: 160, gap: 10 });
        setPreviewDataUrl(canvas.toDataURL('image/png'));
      } catch (e) {
        console.error('Failed generating preview', e);
      }
    };
    run();
  }, [selectedIds]);


  const searchApps = async (term?: string) => {
    const searchValue = term || searchTerm;
    
    if (!searchValue.trim()) {
      if (!term) { // Only show alert for direct search, not for history clicks
        alert('Please enter a search term');
      }
      return;
    }

    try {
      setIsLoading(true);
      
      // Add search term to history if not already present
      setSearchHistory(prev => {
        const newHistory = [searchValue, ...prev.filter(t => t !== searchValue)].slice(0, 5);
        return newHistory;
      });

      // Search apps across all categories for better user experience
      const filteredApps = await AppService.searchAppsByCategory(searchValue, ['app', 'game']);
      
      // Get app store IDs for iTunes API lookup
      const appStoreIds = filteredApps.map(app => app.app_store_id);
      
      // Fetch app details from iTunes API
      const appDetails = await AppService.getAppDetails(appStoreIds);
      
      // Map the data and sort by name
      const allApps = appDetails
        .map(app => {
          const dbApp = filteredApps.find(dbApp => dbApp.app_store_id === app.trackId.toString());
          return {
            ...app,
            trackName: dbApp ? dbApp.name : app.trackName
          };
        })
        .sort((a, b) => a.trackName.localeCompare(b.trackName));

      // Extract dominant colors for each app
      const appsWithColors = await Promise.all(
        allApps.map(async (app) => {
          try {
            const color = await AppService.getDominantColor(app.artworkUrl100);
            return { ...app, dominantColor: color };
          } catch (error) {
            console.error('Error getting dominant color for', app.trackName, error);
            return { ...app, dominantColor: '#666666' }; // Fallback color
          }
        })
      );

      setApps(appsWithColors);
      setHasSearched(true);
      if (term) {
        setSearchTerm(term);
      }
    } catch (error) {
      console.error('Error searching apps:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const clearSearch = () => {
    setSearchTerm('');
    setHasSearched(false);
    loadAppsByCategory();
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      setIsSearchHistoryOpen(false);
      searchApps();
    }
  };

  const handleCopyLogo = async (appId: string, imageSrc?: string) => {
    try {
      // Prefer element to preserve border radius; fallback to URL helper if not found
      const el = imgRefs.current.get(appId);
      const result = el ? await copySingleImageWithRadius(el) : await copyImageAsPng(imageSrc || '');
      const message = result === 'copied' ? 'Copied!' : 'Downloaded!';
      setCopyStatus(prev => ({ ...prev, [appId]: message }));
      
      // Clear status after 1.2 seconds
      setTimeout(() => {
        setCopyStatus(prev => {
          const newStatus = { ...prev };
          delete newStatus[appId];
          return newStatus;
        });
      }, 1200);
    } catch (error) {
      console.error('Error copying logo:', error);
      setCopyStatus(prev => ({ ...prev, [appId]: 'Failed to copy' }));
      
      setTimeout(() => {
        setCopyStatus(prev => {
          const newStatus = { ...prev };
          delete newStatus[appId];
          return newStatus;
        });
      }, 1200);
    }
  };

  const toggleSelect = (appId: string) => {
    setSelectedIds(prev => prev.includes(appId) ? prev.filter(id => id !== appId) : [...prev, appId]);
  };

  const clearSelection = () => setSelectedIds([]);

  const copySelected = async () => {
    if (selectedIds.length === 0) return;
    try {
      setIsGenerating(true);
      const imgs: HTMLImageElement[] = selectedIds
        .map(id => imgRefs.current.get(id))
        .filter((el): el is HTMLImageElement => !!el);
      if (imgs.length === 0) throw new Error('No images to copy');
      const canvas = await generateCombinedCanvas(imgs, { cellSize: 512, gap: 28 });
      const blob: Blob = await new Promise((resolve, reject) => {
        try {
          canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Failed to create blob'))), 'image/png');
        } catch (err) {
          reject(err);
        }
      });
      if (navigator.clipboard && (window as any).ClipboardItem) {
        try {
          await navigator.clipboard.write([
            new (window as any).ClipboardItem({ 'image/png': blob })
          ]);
          setGlobalMessage('Copied combined image to clipboard');
        } catch (err) {
          console.warn('Clipboard API failed, falling back to download:', err);
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `app-logos-${selectedIds.length}.png`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          setGlobalMessage('Downloaded combined image');
        }
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `app-logos-${selectedIds.length}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setGlobalMessage('Downloaded combined image');
      }
      setSelectedIds([]);
      setTimeout(() => setGlobalMessage(null), 1500);
    } catch (e) {
      console.error('Failed to copy selected images', e);
      setGlobalMessage('Failed to copy');
      setTimeout(() => setGlobalMessage(null), 1500);
    } finally {
      setIsGenerating(false);
    }
  };



  return (
    <>
      <div className="sticky-container">
        <header>
          <div className="header-content">
            <div className="logo">
              <span className="logo-desktop">Aldo</span>
              <span className="logo-mobile">Aldo</span>
            </div>
            <div className="category-tabs" role="tablist" aria-label="Category">
              <button
                type="button"
                role="tab"
                aria-selected={selectedCategory === 'app'}
                className={`category-tab ${selectedCategory === 'app' ? 'active' : ''}`}
                onClick={() => {
                  if (selectedCategory !== 'app') {
                    setSelectedCategory('app');
                  }
                }}
              >
                Apps
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={selectedCategory === 'game'}
                className={`category-tab ${selectedCategory === 'game' ? 'active' : ''}`}
                onClick={() => {
                  if (selectedCategory !== 'game') {
                    setSelectedCategory('game');
                  }
                }}
              >
                Games
              </button>
            </div>
            <div className="search-section">
              <div className="search-input-container">
                <svg
                  className="search-icon"
                  onClick={() => searchApps()}
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M15.5 14h-.79l-.28-.27a6.5 6.5 0 1 0-.7.7l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0A4.5 4.5 0 1 1 14 9.5 4.5 4.5 0 0 1 9.5 14z"
                    fill="currentColor"
                  />
                </svg>
                <svg
                  className="clear-icon"
                  onClick={clearSearch}
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  style={{ display: hasSearched ? 'block' : 'none' }}
                >
                  <path
                    d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"
                    fill="currentColor"
                  />
                </svg>
                <input
                  type="text"
                  id="search-input"
                  placeholder="Search app database..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyPress={handleKeyPress}
                  onFocus={() => setIsSearchHistoryOpen(true)}
                />
                <SearchHistoryDropdown
                  history={searchHistory}
                  onSelect={(term) => {
                    searchApps(term);
                    setIsSearchHistoryOpen(false);
                  }}
                  isOpen={isSearchHistoryOpen}
                  setIsOpen={setIsSearchHistoryOpen}
                />
              </div>
            </div>
          </div>
        </header>
      </div>

      <div className="container">
        {/* Color filter bar */}
        <div className="color-filter">
          {COLORS.map((c) => (
            <button
              key={c.id}
              className={`color-dot ${c.id === 'all' ? 'all' : ''} ${selectedColor === c.id ? 'selected' : ''}`}
              title={c.name}
              aria-label={c.name}
              aria-pressed={selectedColor === c.id}
              onClick={() => setSelectedColor(c.id)}
              style={c.id !== 'all' ? ({ backgroundColor: c.value } as React.CSSProperties) : undefined}
            />
          ))}
        </div>
        {isLoading ? (
          <div className="loading-container">
            <div className="loading-spinner"></div>
            <p>Loading apps...</p>
          </div>
        ) : (
          <>
            {displayedApps.length === 0 ? (
              <p>No apps found.</p>
            ) : (
              <div className="apps-container">
                {displayedApps.map(app => (
                  <div key={app.trackId} className={`app-card ${selectedIds.includes(app.trackId.toString()) ? 'is-selected' : ''}`} tabIndex={0}>
                    <div 
                      className="app-link"
                      style={{ '--app-color': app.dominantColor } as React.CSSProperties}
                    >
                      <div className="app-logo-container" title={app.trackName}>
                        {(() => {
                          const largeRaw = app.artworkUrl100.replace('100x100', '512x512');
                          const smallRaw = app.artworkUrl100; // 100x100
                          const large = `${largeRaw}${largeRaw.includes('?') ? '&' : '?'}cors=1`;
                          const small = `${smallRaw}${smallRaw.includes('?') ? '&' : '?'}cors=1`;
                          const id = app.trackId.toString();
                          const isLoaded = !!imageLoaded[id];
                          return (
                            <>
                              {!isLoaded && <div className="logo-skeleton" aria-hidden="true"></div>}
                              <img
                                src={small}
                                srcSet={`${small} 100w, ${large} 512w`}
                                sizes="(max-width: 768px) 50vw, 12vw"
                                alt={app.trackName}
                                className={`app-logo ${isLoaded ? 'is-visible' : 'is-hidden'}`}
                                loading="lazy"
                                decoding="async"
                                crossOrigin="anonymous"
                                width={512}
                                height={512}
                                onLoad={() => handleImageLoad(id)}
                                onError={() => handleImageError(id)}
                                ref={(el) => {
                                  if (el) imgRefs.current.set(id, el);
                                  else imgRefs.current.delete(id);
                                }}
                              />
                            </>
                          );
                        })()}
                        <button
                          type="button"
                          className={`select-checkbox ${selectedIds.includes(app.trackId.toString()) ? 'checked' : ''}`}
                          onClick={(e) => { e.stopPropagation(); toggleSelect(app.trackId.toString()); }}
                          aria-label={selectedIds.includes(app.trackId.toString()) ? 'Deselect' : 'Select'}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        </button>
                        <button
                          className="copy-button"
                          onClick={() => handleCopyLogo(app.trackId.toString(), app.artworkUrl100.replace('100x100', '512x512'))}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              handleCopyLogo(app.trackId.toString(), app.artworkUrl100.replace('100x100', '512x512'));
                            }
                          }}
                          aria-label="Copy logo"
                          aria-live="polite"
                        >
                          {copyStatus[app.trackId.toString()] || 'Copy'}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {selectedIds.length > 0 && (
        <div className="selection-bar" role="region" aria-live="polite">
          <div className="selection-left">
            <span className="selection-count">{selectedIds.length} {selectedIds.length === 1 ? 'image' : 'images'} selected</span>
            {previewDataUrl && (
              <img className="selection-preview" src={previewDataUrl} alt="Preview of combined image" />
            )}
          </div>
          <div className="selection-actions">
            <button className="selection-clear" onClick={clearSelection} disabled={isGenerating}>Clear</button>
            <button className="selection-copy" onClick={copySelected} disabled={isGenerating}>
              {isGenerating ? 'Preparing…' : 'Copy combined'}
            </button>
          </div>
        </div>
      )}

      {globalMessage && (
        <div className="toast" aria-live="polite">{globalMessage}</div>
      )}

      <footer>
        {totalAppCount > 0 && (
          <>
            {totalAppCount.toLocaleString()} {totalAppCount === 1 ? 'app logo' : 'app logos'} · 
          </>
        )} Built using Cursor by <a href="https://hugodesigner.framer.website/" target="_blank" rel="noopener noreferrer">Hugo Kestali</a>
      </footer>
    </>
  );
}

export default App;
