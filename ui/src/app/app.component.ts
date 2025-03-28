import { Component, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { faTrashAlt, faCheckCircle, faTimesCircle, IconDefinition } from '@fortawesome/free-regular-svg-icons';
import { faRedoAlt, faSun, faMoon, faCircleHalfStroke, faCheck, faExternalLinkAlt, faDownload, faInfoCircle } from '@fortawesome/free-solid-svg-icons';
import { CookieService } from 'ngx-cookie-service';
import { map, Observable, of } from 'rxjs';

import { Download, DownloadsService, Status } from './downloads.service';
import { MasterCheckboxComponent } from './master-checkbox.component';
import { Formats, Format, Quality } from './formats';
import { Theme, Themes } from './theme';
import {KeyValue} from "@angular/common";

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.sass'],
})
export class AppComponent implements AfterViewInit {
  addUrl: string;
  formats: Format[] = Formats;
  qualities: Quality[];
  quality: string;
  format: string;
  folder: string;
  customNamePrefix: string;
  autoStart: boolean;
  playlistStrictMode: boolean;
  playlistItemLimit: number;
  addInProgress = false;
  themes: Theme[] = Themes;
  activeTheme: Theme;
  customDirs$: Observable<string[]>;
  showBatchPanel: boolean = false; 
  batchImportModalOpen = false;
  batchImportText = '';
  batchImportStatus = '';
  importInProgress = false;
  cancelImportFlag = false;
  versionInfo: string | null = null;
  infoModalOpen = false;
  supportedSitesContent: string;
  showInstallPrompt = false;

  @ViewChild('queueMasterCheckbox') queueMasterCheckbox: MasterCheckboxComponent;
  @ViewChild('queueDelSelected') queueDelSelected: ElementRef;
  @ViewChild('queueDownloadSelected') queueDownloadSelected: ElementRef;
  @ViewChild('doneMasterCheckbox') doneMasterCheckbox: MasterCheckboxComponent;
  @ViewChild('doneDelSelected') doneDelSelected: ElementRef;
  @ViewChild('doneClearCompleted') doneClearCompleted: ElementRef;
  @ViewChild('doneClearFailed') doneClearFailed: ElementRef;
  @ViewChild('doneRetryFailed') doneRetryFailed: ElementRef;
  @ViewChild('doneDownloadSelected') doneDownloadSelected: ElementRef;

  faTrashAlt = faTrashAlt;
  faCheckCircle = faCheckCircle;
  faTimesCircle = faTimesCircle;
  faRedoAlt = faRedoAlt;
  faSun = faSun;
  faMoon = faMoon;
  faCheck = faCheck;
  faCircleHalfStroke = faCircleHalfStroke;
  faDownload = faDownload;
  faExternalLinkAlt = faExternalLinkAlt;
  faInfoCircle = faInfoCircle;

  constructor(public downloads: DownloadsService, private cookieService: CookieService, private http: HttpClient) {
    this.format = cookieService.get('metube_format') || 'mp3';
    // Needs to be set or qualities won't automatically be set
    this.setQualities()
    this.quality = cookieService.get('metube_quality') || 'best';
    this.autoStart = cookieService.get('metube_auto_start') !== 'false';

    this.activeTheme = this.getPreferredTheme(cookieService);
    this.loadSupportedSitesContent();
  }

  ngOnInit() {
    // Show install prompt for 5 seconds when the app loads
    this.showInstallPrompt = true;
    setTimeout(() => {
      this.dismissInstallPrompt();
    }, 5000);

    this.getConfiguration();
    this.customDirs$ = this.getMatchingCustomDir();
    this.setTheme(this.activeTheme);

    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (this.activeTheme.id === 'auto') {
         this.setTheme(this.activeTheme);
      }
    });
  }

  ngAfterViewInit() {
    this.downloads.queueChanged.subscribe(() => {
      this.queueMasterCheckbox.selectionChanged();
    });
    this.downloads.doneChanged.subscribe(() => {
      this.doneMasterCheckbox.selectionChanged();
      let completed: number = 0, failed: number = 0;
      this.downloads.done.forEach(dl => {
        if (dl.status === 'finished')
          completed++;
        else if (dl.status === 'error')
          failed++;
      });
      this.doneClearCompleted.nativeElement.disabled = completed === 0;
      this.doneClearFailed.nativeElement.disabled = failed === 0;
      this.doneRetryFailed.nativeElement.disabled = failed === 0;
    });
    this.fetchVersionInfo();
  }

  // workaround to allow fetching of Map values in the order they were inserted
  //  https://github.com/angular/angular/issues/31420
  asIsOrder(a, b) {
    return 1;
  }

  qualityChanged() {
    this.cookieService.set('metube_quality', this.quality, { expires: 3650 });
    // Re-trigger custom directory change
    this.downloads.customDirsChanged.next(this.downloads.customDirs);
  }

  showAdvanced() {
    return this.downloads.configuration['CUSTOM_DIRS'];
  }

  allowCustomDir(tag: string) {
    if (this.downloads.configuration['CREATE_CUSTOM_DIRS']) {
      return tag;
    }
    return false;
  }

  isAudioType() {
    return this.quality == 'audio' || this.format == 'mp3'  || this.format == 'm4a' || this.format == 'opus' || this.format == 'wav' || this.format == 'flac';
  }

  getMatchingCustomDir() : Observable<string[]> {
    return this.downloads.customDirsChanged.asObservable().pipe(map((output) => {
      // Keep logic consistent with app/ytdl.py
      if (this.isAudioType()) {
        console.debug("Showing audio-specific download directories");
        return output["audio_download_dir"];
      } else {
        console.debug("Showing default download directories");
        return output["download_dir"];
      }
    }));
  }

  getConfiguration() {
    this.downloads.configurationChanged.subscribe({
      next: (config) => {
        this.playlistStrictMode = config['DEFAULT_OPTION_PLAYLIST_STRICT_MODE'];
        const playlistItemLimit = config['DEFAULT_OPTION_PLAYLIST_ITEM_LIMIT'];
        if (playlistItemLimit !== '0') {
          this.playlistItemLimit = playlistItemLimit;
        }
      }
    });
  }

  getPreferredTheme(cookieService: CookieService) {
    let theme = 'auto';
    if (cookieService.check('metube_theme')) {
      theme = cookieService.get('metube_theme');
    }

    return this.themes.find(x => x.id === theme) ?? this.themes.find(x => x.id === 'auto');
  }

  themeChanged(theme: Theme) {
    this.cookieService.set('metube_theme', theme.id, { expires: 3650 });
    this.setTheme(theme);
  }

  setTheme(theme: Theme) {
    this.activeTheme = theme;
    if (theme.id === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      document.documentElement.setAttribute('data-bs-theme', 'dark');
    } else {
      document.documentElement.setAttribute('data-bs-theme', theme.id);
    }
  }

  formatChanged() {
    this.cookieService.set('metube_format', this.format, { expires: 3650 });
    // Updates to use qualities available
    this.setQualities()
    // Set best_ios as default for MP4
    if (this.format === 'mp4') {
      this.quality = 'best_ios';
      this.cookieService.set('metube_quality', this.quality, { expires: 3650 });
    }
    // Re-trigger custom directory change
    this.downloads.customDirsChanged.next(this.downloads.customDirs);
  }

  autoStartChanged() {
    this.cookieService.set('metube_auto_start', this.autoStart ? 'true' : 'false', { expires: 3650 });
  }

  queueSelectionChanged(checked: number) {
    this.queueDelSelected.nativeElement.disabled = checked == 0;
    this.queueDownloadSelected.nativeElement.disabled = checked == 0;
  }

  doneSelectionChanged(checked: number) {
    this.doneDelSelected.nativeElement.disabled = checked == 0;
    this.doneDownloadSelected.nativeElement.disabled = checked == 0;
  }

  setQualities() {
    // qualities for specific format
    this.qualities = this.formats.find(el => el.id == this.format).qualities
    const exists = this.qualities.find(el => el.id === this.quality)
    if (!exists) {
      // Set default quality based on format
      this.quality = this.format === 'mp4' ? 'best_ios' : 'best'
    }
  }

  addDownload(url?: string, quality?: string, format?: string, folder?: string, customNamePrefix?: string, playlistStrictMode?: boolean, playlistItemLimit?: number, autoStart?: boolean) {
    url = url ?? this.addUrl
    quality = quality ?? this.quality
    format = format ?? this.format
    folder = folder ?? this.folder
    customNamePrefix = customNamePrefix ?? this.customNamePrefix
    playlistStrictMode = playlistStrictMode ?? this.playlistStrictMode
    playlistItemLimit = playlistItemLimit ?? this.playlistItemLimit
    autoStart = autoStart ?? this.autoStart

    console.debug('Downloading: url='+url+' quality='+quality+' format='+format+' folder='+folder+' customNamePrefix='+customNamePrefix+' playlistStrictMode='+playlistStrictMode+' playlistItemLimit='+playlistItemLimit+' autoStart='+autoStart);
    this.addInProgress = true;
    this.downloads.add(url, quality, format, folder, customNamePrefix, playlistStrictMode, playlistItemLimit, autoStart).subscribe((status: Status) => {
      if (status.status === 'error') {
        alert(`Error adding URL: ${status.msg}`);
      } else {
        this.addUrl = '';
      }
      this.addInProgress = false;
    });
  }

  downloadItemByKey(id: string) {
    this.downloads.startById([id]).subscribe();
  }

  retryDownload(key: string, download: Download) {
    this.addDownload(download.url, download.quality, download.format, download.folder, download.custom_name_prefix, download.playlist_strict_mode, download.playlist_item_limit, true);
    this.downloads.delById('done', [key]).subscribe();
  }

  delDownload(where: string, id: string) {
    this.downloads.delById(where, [id]).subscribe();
  }

  startSelectedDownloads(where: string){
    this.downloads.startByFilter(where, dl => dl.checked).subscribe();
  }

  delSelectedDownloads(where: string) {
    this.downloads.delByFilter(where, dl => dl.checked).subscribe();
  }

  clearCompletedDownloads() {
    this.downloads.delByFilter('done', dl => dl.status === 'finished').subscribe();
  }

  clearFailedDownloads() {
    this.downloads.delByFilter('done', dl => dl.status === 'error').subscribe();
  }

  retryFailedDownloads() {
    this.downloads.done.forEach((dl, key) => {
      if (dl.status === 'error') {
        this.retryDownload(key, dl);
      }
    });
  }

  downloadSelectedFiles() {
    this.downloads.done.forEach((dl, key) => {
      if (dl.status === 'finished' && dl.checked) {
        const link = document.createElement('a');
        link.href = this.buildDownloadLink(dl);
        link.setAttribute('download', dl.filename);
        link.setAttribute('target', '_self');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    });
  }

  buildDownloadLink(download: Download) {
    let baseDir = this.downloads.configuration["PUBLIC_HOST_URL"];
    if (download.quality == 'audio' || download.filename.endsWith('.mp3')) {
      baseDir = this.downloads.configuration["PUBLIC_HOST_AUDIO_URL"];
    }

    if (download.folder) {
      baseDir += download.folder + '/';
    }

    return baseDir + encodeURIComponent(download.filename);
  }

  identifyDownloadRow(index: number, row: KeyValue<string, Download>) {
    return row.key;
  }

  isNumber(event) {
    const charCode = (event.which) ? event.which : event.keyCode;
    if (charCode > 31 && (charCode < 48 || charCode > 57)) {
      event.preventDefault();
    }
  }

  // Toggle inline batch panel (if you want to use an inline panel for export; not used for import modal)
  toggleBatchPanel(): void {
    this.showBatchPanel = !this.showBatchPanel;
  }

  // Open the Batch Import modal
  openBatchImportModal(): void {
    this.batchImportModalOpen = true;
    this.batchImportText = '';
    this.batchImportStatus = '';
    this.importInProgress = false;
    this.cancelImportFlag = false;
  }

  // Close the Batch Import modal
  closeBatchImportModal(): void {
    this.batchImportModalOpen = false;
  }

  // Start importing URLs from the batch modal textarea
  startBatchImport(): void {
    const urls = this.batchImportText
      .split(/\r?\n/)
      .map(url => url.trim())
      .filter(url => url.length > 0);
    if (urls.length === 0) {
      alert('No valid URLs found.');
      return;
    }
    this.importInProgress = true;
    this.cancelImportFlag = false;
    this.batchImportStatus = `Starting to import ${urls.length} URLs...`;
    let index = 0;
    const delayBetween = 1000;
    const processNext = () => {
      if (this.cancelImportFlag) {
        this.batchImportStatus = `Import cancelled after ${index} of ${urls.length} URLs.`;
        this.importInProgress = false;
        return;
      }
      if (index >= urls.length) {
        this.batchImportStatus = `Finished importing ${urls.length} URLs.`;
        this.importInProgress = false;
        return;
      }
      const url = urls[index];
      this.batchImportStatus = `Importing URL ${index + 1} of ${urls.length}: ${url}`;
      // Now pass the selected quality, format, folder, etc. to the add() method
      this.downloads.add(url, this.quality, this.format, this.folder, this.customNamePrefix,
        this.playlistStrictMode, this.playlistItemLimit, this.autoStart)
        .subscribe({
          next: (status: Status) => {
            if (status.status === 'error') {
              alert(`Error adding URL ${url}: ${status.msg}`);
            }
            index++;
            setTimeout(processNext, delayBetween);
          },
          error: (err) => {
            console.error(`Error importing URL ${url}:`, err);
            index++;
            setTimeout(processNext, delayBetween);
          }
        });
    };
    processNext();
  }

  // Cancel the batch import process
  cancelBatchImport(): void {
    if (this.importInProgress) {
      this.cancelImportFlag = true;
      this.batchImportStatus += ' Cancelling...';
    }
  }

  // Export URLs based on filter: 'pending', 'completed', 'failed', or 'all'
  exportBatchUrls(filter: 'pending' | 'completed' | 'failed' | 'all'): void {
    let urls: string[];
    if (filter === 'pending') {
      urls = Array.from(this.downloads.queue.values()).map(dl => dl.url);
    } else if (filter === 'completed') {
      // Only finished downloads in the "done" Map
      urls = Array.from(this.downloads.done.values()).filter(dl => dl.status === 'finished').map(dl => dl.url);
    } else if (filter === 'failed') {
      // Only error downloads from the "done" Map
      urls = Array.from(this.downloads.done.values()).filter(dl => dl.status === 'error').map(dl => dl.url);
    } else {
      // All: pending + both finished and error in done
      urls = [
        ...Array.from(this.downloads.queue.values()).map(dl => dl.url),
        ...Array.from(this.downloads.done.values()).map(dl => dl.url)
      ];
    }
    if (!urls.length) {
      alert('No URLs found for the selected filter.');
      return;
    }
    const content = urls.join('\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const downloadUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = 'metube_urls.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(downloadUrl);
  }

  // Copy URLs to clipboard based on filter: 'pending', 'completed', 'failed', or 'all'
  copyBatchUrls(filter: 'pending' | 'completed' | 'failed' | 'all'): void {
    let urls: string[];
    if (filter === 'pending') {
      urls = Array.from(this.downloads.queue.values()).map(dl => dl.url);
    } else if (filter === 'completed') {
      urls = Array.from(this.downloads.done.values()).filter(dl => dl.status === 'finished').map(dl => dl.url);
    } else if (filter === 'failed') {
      urls = Array.from(this.downloads.done.values()).filter(dl => dl.status === 'error').map(dl => dl.url);
    } else {
      urls = [
        ...Array.from(this.downloads.queue.values()).map(dl => dl.url),
        ...Array.from(this.downloads.done.values()).map(dl => dl.url)
      ];
    }
    if (!urls.length) {
      alert('No URLs found for the selected filter.');
      return;
    }
    const content = urls.join('\n');
    navigator.clipboard.writeText(content)
      .then(() => alert('URLs copied to clipboard.'))
      .catch(() => alert('Failed to copy URLs.'));
  }

  fetchVersionInfo(): void {
    const baseUrl = `${window.location.origin}${window.location.pathname.replace(/\/[^\/]*$/, '/')}`;
    const versionUrl = `${baseUrl}version`;
    this.http.get<{ version: string}>(versionUrl)
      .subscribe({
        next: (data) => {
          this.versionInfo = `yt-dlp version: ${data.version}`;
        },
        error: () => {
          this.versionInfo = '';
        }
      });
  }

  async tryPasteFromClipboard() {
    // Only proceed if the field is empty
    if (this.addUrl) {
      return;
    }

    // Check if the Clipboard API is available
    if (!navigator.clipboard) {
      console.debug('Clipboard API not available');
      return;
    }

    try {
      const text = await navigator.clipboard.readText();
      
      // Check if we got text and it looks like a URL
      if (text && /^https?:\/\//i.test(text)) {
        this.addUrl = text;
      }
    } catch (err) {
      // This can happen if permission is denied or HTTPS is required
      console.debug('Could not access clipboard:', err);
    }
  }

  loadSupportedSitesContent() {
    const content = `
      <div class="supported-sites-content">
        <p>Supports 1,845 websites including Youtube, Twitter, Instagram, Facebook, Tiktok, etc.</p>
        
        <h3>Major Platforms</h3>
        <p><strong>YouTube:</strong></p>
        <ul>
          <li>youtube:all</li>
          <li>youtube:playlist</li>
          <li>youtube:search</li>
          <li>youtube:user</li>
          <li>youtube:channel</li>
          <li>youtube:shorts</li>
          <li>youtube:tab</li>
          <li>youtube:live</li>
          <li>YoutubeYtBe</li>
        </ul>

        <p><strong>Twitter:</strong></p>
        <ul>
          <li>twitter:all</li>
          <li>twitter:broadcast</li>
          <li>twitter:spaces</li>
          <li>twitter:card</li>
        </ul>

        <p><strong>Instagram:</strong></p>
        <ul>
          <li>instagram:all</li>
          <li>instagram:story</li>
          <li>instagram:user</li>
          <li>instagram:tag</li>
        </ul>

        <p><strong>Facebook:</strong></p>
        <ul>
          <li>facebook:all</li>
          <li>facebook:reel</li>
          <li>FacebookPluginsVideo</li>
        </ul>

        <p><strong>TikTok:</strong></p>
        <ul>
          <li>tiktok:all</li>
          <li>tiktok:user</li>
          <li>tiktok:live</li>
          <li>tiktok:collection</li>
        </ul>

        <p><strong>Twitch:</strong></p>
        <ul>
          <li>twitch:all</li>
          <li>twitch:clips</li>
          <li>twitch:stream</li>
          <li>twitch:vod</li>
          <li>TwitchCollection</li>
          <li>TwitchVideos</li>
        </ul>

        <p><strong>LinkedIn:</strong> linkedin:learning</p>
        <p><strong>Reddit</strong></p>

        <h3>Video Platforms</h3>
        <p><strong>Vimeo:</strong></p>
        <ul>
          <li>vimeo:all</li>
          <li>vimeo:album</li>
          <li>vimeo:channel</li>
          <li>vimeo:user</li>
        </ul>

        <p><strong>Dailymotion:</strong></p>
        <ul>
          <li>dailymotion:all</li>
          <li>dailymotion:playlist</li>
          <li>dailymotion:user</li>
        </ul>

        <h3>Music & Audio</h3>
        <p><strong>SoundCloud:</strong></p>
        <ul>
          <li>soundcloud:all</li>
          <li>soundcloud:playlist</li>
          <li>soundcloud:user</li>
          <li>soundcloud:set</li>
        </ul>

        <p><strong>Spotify:</strong> Spotify episodes and shows</p>
        <ul>
          <li>spotify:show</li>
          <li>spotify:playlist</li>
          <li>spotify:album</li>
          <li>spotify:artist</li>
          <li>spotify:track</li>
          <li>spotify:user</li>
          
        </ul>

        <p><strong>Bandcamp:</strong></p>
        <ul>
          <li>bandcamp:all</li>
          <li>Bandcamp:album</li>
          <li>Bandcamp:user</li>
        </ul>

        <h3>News & Media</h3>
        <ul>
          <li>BBC</li>
          <li>CNN</li>
          <li>Reuters</li>
          <li>NYTimes</li>
          <li>Washington Post</li>
          <li>The Guardian</li>
          <li>Bloomberg</li>
          <li>CNBC</li>
          <li>NBC News</li>
          <li>CBS News</li>
          <li>ABC News</li>
          <li>Fox News</li>
        </ul>

        <h3>Learning Platforms</h3>
        <ul>
          <li>Coursera</li>
          <li>Udemy</li>
          <li>edX</li>
          <li>Khan Academy</li>
          <li>MIT OpenCourseWare</li>
          <li>Stanford Online</li>
        </ul>

        <h3>Video Conferencing</h3>
        <ul>
          <li>Zoom</li>
          <li>WebEx</li>
          <li>Google Meet</li>
        </ul>

        <h3>Cloud Storage</h3>
        <ul>
          <li>Google Drive</li>
          <li>OneDrive</li>
          <li>Dropbox</li>
        </ul>

        <h3>Other Platforms</h3>
        <ul>
          <li><strong>Archive.org:</strong> Internet Archive video and audio</li>
          <li>NPR</li>
          <li>PBS</li>
          <li><strong>TED:</strong></li>
          <ul>
            <li>TedTalk</li>
            <li>TedPlaylist</li>
            <li>TedSeries</li>
          </ul>
          <li>Vevo</li>
          <li><strong>IMDb:</strong> Internet Movie Database trailers</li>
          <li>Discord</li>
          <li>Telegram</li>
        </ul>

        <p>Full list of sites supported <a href="https://github.com/yt-dlp/yt-dlp/blob/master/supportedsites.md" target="_blank">here</a>.</p>
      </div>
    `;
    this.supportedSitesContent = content;
  }

  openInfoModal() {
    this.infoModalOpen = true;
  }

  closeInfoModal() {
    this.infoModalOpen = false;
  }

  dismissInstallPrompt() {
    this.showInstallPrompt = false;
  }
}
