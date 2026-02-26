import { Component, OnInit, OnDestroy } from '@angular/core';
import { MediaModel } from "./media.model";
import { NgbModal } from "@ng-bootstrap/ng-bootstrap";
import { PaginationService } from "../../../core/services/pagination.service";
import { UntypedFormBuilder } from "@angular/forms";
import { MediaService, MediaListResult, UploadedFile } from "../../../core/services/media.service";
import { LandingMediaService } from "../../../core/services/landing-media.service";
import { Subject, takeUntil, debounceTime, distinctUntilChanged } from 'rxjs';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SharedModule } from '../../../shared/shared.module';
import { NgbModule } from '@ng-bootstrap/ng-bootstrap';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-medias',
  standalone: true,
  imports: [CommonModule, FormsModule, SharedModule, NgbModule],
  templateUrl: './medias.component.html',
  styleUrl: './medias.component.scss'
})
export class MediasComponent implements OnInit, OnDestroy {

    // bread crumb items
    breadCrumbItems!: Array<{}>;

    // Component state
    basicData: MediaModel[] = [];
    public isCollapsed = false;
    searchTerm: string = '';
    type: string = '';
    
    // Loading and pagination state
    loading = false;
    totalMedias = 0;
    currentPage = 0;
    pageSize = 20;
    
    // Upload state
    selectedFile: File | null = null;
    uploading = false;
    
    // File upload properties (from variants-list approach)
    uploadedFiles: UploadedFile[] = [];
    uploadingFiles = false;
    
    // Media name for upload
    uploadMediaName: string = '';
    
    // Edit media state
    editingMedia: MediaModel | null = null;
    editMediaName: string = '';
    editUploadedFile: UploadedFile | null = null;
    editUploading: boolean = false;
    
    // Preview media state
    previewingMedia: MediaModel | null = null;
    
    // All Categorie Video (landing page)
    readonly ALL_CATEGORIE_VIDEO_NAME = 'All Categorie Video';
    allCategorieVideo: MediaModel | null = null;
    allCategorieVideoLoading = false;
    allCategorieVideoUploading = false;
    allCategorieVideoFile: UploadedFile | null = null;
    
    // Destroy subject for cleanup
    private destroy$ = new Subject<void>();
    private searchSubject = new Subject<string>();

    constructor(
        private modalService: NgbModal, 
        public service: PaginationService, 
        private formBuilder: UntypedFormBuilder,
        private mediaService: MediaService,
        private landingMediaService: LandingMediaService
    ) {
        // Setup search debouncing
        this.searchSubject.pipe(
            debounceTime(300),
            distinctUntilChanged(),
            takeUntil(this.destroy$)
        ).subscribe(searchTerm => {
            this.performSearch(searchTerm);
        });
    }

    ngOnInit(): void {
        /**
         * BreadCrumb
         */
        this.breadCrumbItems = [
            { label: 'Media Management' },
            { label: 'All Media', active: true }
        ];

        // Load initial data
        this.loadMedias();
        this.loadAllCategorieVideo();
    }
    
    ngOnDestroy(): void {
        // Clean up all preview URLs
        this.clearUploadedFiles();
        
        this.destroy$.next();
        this.destroy$.complete();
    }


    /**
     * Load All Categorie Video (used on landing all-categorie page)
     */
    loadAllCategorieVideo(): void {
        this.allCategorieVideoLoading = true;
        this.mediaService.getMediaByName(this.ALL_CATEGORIE_VIDEO_NAME)
            .pipe(takeUntil(this.destroy$))
            .subscribe({
                next: (media) => {
                    this.allCategorieVideo = media;
                    this.allCategorieVideoLoading = false;
                },
                error: () => {
                    this.allCategorieVideoLoading = false;
                }
            });
    }

    /**
     * Handle All Categorie Video file selection
     */
    onAllCategorieVideoSelected(event: Event): void {
        const input = event.target as HTMLInputElement;
        const file = input?.files?.[0];
        if (file && file.type.startsWith('video/')) {
            this.allCategorieVideoFile = this.mediaService.createUploadedFile(file);
        } else if (file) {
            Swal.fire({
                icon: 'warning',
                title: 'Format invalide',
                text: 'Veuillez sélectionner un fichier vidéo (MP4, WebM, etc.).',
                confirmButtonColor: '#3085d6'
            });
        }
        input.value = '';
    }

    /**
     * Upload/replace All Categorie Video
     */
    async uploadAllCategorieVideo(): Promise<void> {
        if (!this.allCategorieVideoFile || !this.mediaService.canUpload()) return;

        this.allCategorieVideoUploading = true;
        try {
            const result = await this.mediaService.uploadFileToStorage(
                this.allCategorieVideoFile,
                'medias',
                this.ALL_CATEGORIE_VIDEO_NAME
            );
            if (result) {
                this.allCategorieVideo = result;
                this.allCategorieVideoFile = null;
                this.landingMediaService.refreshMediaUrl(this.ALL_CATEGORIE_VIDEO_NAME);
                await Swal.fire({
                    icon: 'success',
                    title: 'Vidéo mise à jour',
                    text: 'La vidéo de la page All Categorie a été mise à jour.',
                    timer: 2000,
                    showConfirmButton: false,
                    toast: true,
                    position: 'top-end'
                });
            }
        } catch (error) {
            await Swal.fire({
                icon: 'error',
                title: 'Erreur',
                text: (error as Error)?.message || 'Échec de l\'upload.',
                confirmButtonColor: '#d33'
            });
        } finally {
            this.allCategorieVideoUploading = false;
        }
    }

    /**
     * Clear All Categorie Video selection
     */
    clearAllCategorieVideoSelection(): void {
        this.allCategorieVideoFile = null;
    }

    /**
     * Load medias from Supabase
     */
    loadMedias(): void {
        this.loading = true;
        this.mediaService.getMedias(this.currentPage, this.pageSize, this.searchTerm.trim() || undefined)
            .pipe(takeUntil(this.destroy$))
            .subscribe({
                next: (result: MediaListResult) => {
                    this.loading = false;
                    if (result.error) {
                        console.error('Error loading medias:', result.error);
                        // You can add toast notification here
                    } else {
                        this.basicData = result.data;
                        this.totalMedias = result.total;
                        
                        // Debug: Log media data to understand the preview issue
                        console.log('Loaded media data:', result.data);
                        result.data.forEach((media, index) => {
                            console.log(`Media ${index + 1}:`, {
                                id: media.id,
                                name: media.media_name,
                                path: media.media_path,
                                url: media.url,
                                type: media.type,
                                hasPath: !!media.media_path,
                                hasUrl: !!media.url
                            });
                            
                            // Test URL accessibility if URL exists
                            if (media.url) {
                                console.log(`Testing URL for ${media.media_name}:`, media.url);
                            }
                        });
                    }
                },
                error: (error) => {
                    this.loading = false;
                    console.error('Error loading medias:', error);
                }
            });
    }

    /**
     * Search medias with debouncing
     */
    onSearchChange(): void {
        this.searchSubject.next(this.searchTerm);
    }

    /**
     * Perform search operation
     */
    private performSearch(searchTerm: string): void {
        this.currentPage = 0; // Reset to first page
        this.loadMedias();
    }

    /**
     * Filter by file type
     */
    typeFilter(): void {
        this.currentPage = 0; // Reset to first page
        this.loadMedias();
    }

    /**
     * Handle file selection for upload (multiple files)
     */
    onFileSelected(event: any): void {
        const files = event.target.files;
        if (files && files.length > 0) {
            for (let i = 0; i < files.length; i++) {
                this.addFile(files[i]);
            }
        }
    }

    /**
     * Add file to upload queue
     */
    addFile(file: File): void {
        if (!file) return;
        
        const uploadedFile = this.mediaService.createUploadedFile(file);
        this.uploadedFiles.push(uploadedFile);
    }

    /**
     * Remove file from upload queue
     */
    removeFile(index: number): void {
        this.uploadedFiles.splice(index, 1);
    }

    /**
     * Upload all selected files
     */
    async uploadFiles(): Promise<void> {
        if (this.uploadedFiles.length === 0) {
            return;
        }

        if (!this.mediaService.canUpload()) {
            await Swal.fire({
                icon: 'warning',
                title: 'Upload Not Allowed',
                text: 'You do not have permission to upload media files.',
                confirmButtonColor: '#3085d6'
            });
            return;
        }

        // Ensure we have an auth session for storage operations
        await this.ensureAuthSession();

        this.uploadingFiles = true;
        
        try {
            const uploadCount = this.uploadedFiles.length;
            
            // Upload files one by one to ensure proper progress tracking
            for (const uploadedFile of this.uploadedFiles) {
                if (!uploadedFile.error && !uploadedFile.url) {
                    const mediaName = this.uploadMediaName.trim() || uploadedFile.file.name;
                    await this.mediaService.uploadFileToStorage(uploadedFile, 'medias', mediaName);
                }
            }
            
            // Clear uploaded files after successful upload
            this.clearUploadedFiles();
            
            // Reload media list
            this.loadMedias();
            
            // Show success notification
            await Swal.fire({
                icon: 'success',
                title: 'Upload Complete!',
                text: `Successfully uploaded ${uploadCount} file(s).`,
                timer: 2000,
                showConfirmButton: false,
                toast: true,
                position: 'top-end'
            });
            
        } catch (error) {
            console.error('Upload error:', error);
            await Swal.fire({
                icon: 'error',
                title: 'Upload Failed',
                text: `Failed to upload files: ${(error as any)?.message || 'Unknown error'}`,
                confirmButtonColor: '#d33'
            });
        } finally {
            this.uploadingFiles = false;
        }
    }

    /**
     * Clear all uploaded files and their previews
     */
    clearUploadedFiles(): void {
        // Clean up any preview URLs we created (no longer needed since we removed preview from interface)
        this.uploadedFiles = [];
        this.uploadMediaName = '';
        
        // Reset file input
        const fileInput = document.getElementById('fileInput') as HTMLInputElement;
        if (fileInput) {
            fileInput.value = '';
        }
    }

    /**
     * Legacy single file upload method (keep for compatibility)
     */
    uploadFile(): void {
        if (!this.selectedFile) {
            return;
        }

        if (!this.mediaService.canUpload()) {
            console.error('Upload not allowed');
            return;
        }

        this.uploading = true;
        this.mediaService.uploadMedia(this.selectedFile)
            .pipe(takeUntil(this.destroy$))
            .subscribe({
                next: (result) => {
                    this.uploading = false;
                    if (result.error) {
                        console.error('Upload error:', result.error);
                        // You can add toast notification here
                    } else {
                        console.log('Upload successful:', result.data);
                        this.selectedFile = null;
                        // Reset file input
                        const fileInput = document.getElementById('fileInput') as HTMLInputElement;
                        if (fileInput) {
                            fileInput.value = '';
                        }
                        // Reload media list
                        this.loadMedias();
                    }
                },
                error: (error) => {
                    this.uploading = false;
                    console.error('Upload error:', error);
                }
            });
    }

    /**
     * Delete media file
     */
    async deleteMedia(media: MediaModel): Promise<void> {
        if (!this.mediaService.canDelete()) {
            await Swal.fire({
                icon: 'warning',
                title: 'Delete Not Allowed',
                text: 'You do not have permission to delete media files.',
                confirmButtonColor: '#3085d6'
            });
            return;
        }

        const result = await Swal.fire({
            title: 'Delete Media?',
            text: `Are you sure you want to delete "${media.media_name || 'this media'}"? This action cannot be undone.`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Yes, delete it!',
            cancelButtonText: 'Cancel'
        });

        if (result.isConfirmed) {
            this.mediaService.deleteMedia(media.id)
                .pipe(takeUntil(this.destroy$))
                .subscribe({
                    next: async (success) => {
                        if (success) {
                            console.log('Delete successful');
                            this.loadMedias(); // Reload list
                            
                            await Swal.fire({
                                icon: 'success',
                                title: 'Deleted!',
                                text: 'Media has been deleted successfully.',
                                timer: 2000,
                                showConfirmButton: false,
                                toast: true,
                                position: 'top-end'
                            });
                        } else {
                            console.error('Delete failed');
                            await Swal.fire({
                                icon: 'error',
                                title: 'Delete Failed',
                                text: 'Failed to delete the media file.',
                                confirmButtonColor: '#d33'
                            });
                        }
                    },
                    error: async (error) => {
                        console.error('Delete error:', error);
                        await Swal.fire({
                            icon: 'error',
                            title: 'Delete Error',
                            text: `An error occurred while deleting: ${error.message || 'Unknown error'}`,
                            confirmButtonColor: '#d33'
                        });
                    }
                });
        }
    }

    /**
     * Get file type icon class
     */
    getFileTypeIcon(type: string): string {
        switch (type?.toLowerCase()) {
            case 'image':
                return 'ri-image-line';
            case 'video':
                return 'ri-video-line';
            case 'audio':
                return 'ri-music-line';
            case 'pdf':
                return 'ri-file-pdf-line';
            case 'document':
                return 'ri-file-text-line';
            case 'archive':
                return 'ri-file-zip-line';
            default:
                return 'ri-file-line';
        }
    }

    /**
     * Format file size
     */
    formatFileSize(bytes: number): string {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    /**
     * Get file type from filename
     */
    getFileType(filename: string): string {
        return this.mediaService.getFileType(filename);
    }

    /**
     * Load more medias (pagination)
     */
    loadMore(): void {
        this.currentPage++;
        this.loading = true;
        this.mediaService.getMedias(this.currentPage, this.pageSize, this.searchTerm.trim() || undefined)
            .pipe(takeUntil(this.destroy$))
            .subscribe({
                next: (result: MediaListResult) => {
                    this.loading = false;
                    if (result.error) {
                        console.error('Error loading more medias:', result.error);
                    } else {
                        this.basicData = [...this.basicData, ...result.data];
                    }
                },
                error: (error) => {
                    this.loading = false;
                    console.error('Error loading more medias:', error);
                }
            });
    }

    /**
     * Check if there are more medias to load
     */
    hasMoreMedias(): boolean {
        return this.basicData.length < this.totalMedias;
    }

    /**
     * Handle drag over event
     */
    onDragOver(event: DragEvent): void {
        event.preventDefault();
        event.stopPropagation();
    }

    /**
     * Handle drop event
     */
    onDrop(event: DragEvent): void {
        event.preventDefault();
        event.stopPropagation();
        
        const files = event.dataTransfer?.files;
        if (files && files.length > 0) {
            for (let i = 0; i < files.length; i++) {
                this.addFile(files[i]);
            }
        }
    }

    /**
     * Check if file type is supported for preview
     */
    isImageFile(file: File): boolean {
        return file.type.startsWith('image/');
    }

    /**
     * Ensure authentication session (for storage operations)
     */
    private async ensureAuthSession(): Promise<void> {
        const supabaseClient = this.mediaService['supabaseClient'];
        
        try {
            const { data: { session } } = await supabaseClient.auth.getSession();
            
            if (!session) {
                console.log('No active session, attempting to sign in anonymously...');
                // Try to create an anonymous session for admin operations
                const { data, error } = await supabaseClient.auth.signInAnonymously();
                if (error) {
                    console.warn('Anonymous sign-in failed:', error);
                } else {
                    console.log('Anonymous session created:', data.session ? 'Success' : 'Failed');
                }
            } else {
                console.log('Active session found:', session.user?.email || 'Anonymous');
            }
        } catch (error) {
            console.warn('Auth session check failed:', error);
        }
    }

    /**
     * Open edit modal for media
     */
    async openEditModal(media: MediaModel, modal: any): Promise<void> {
        console.log('Opening edit modal for media:', media);
        
        // Ensure we have an auth session for storage operations
        await this.ensureAuthSession();
        
        this.editingMedia = media;
        this.editMediaName = media.media_name || '';
        this.editUploadedFile = null;
        this.editUploading = false;
        this.modalService.open(modal, { size: 'lg', centered: true });
    }

    /**
     * Handle file selection for editing
     */
    onEditFileSelected(event: any): void {
        const file = event.target.files[0];
        if (file) {
            console.log('File selected for editing:', file.name, file.type, file.size);
            this.editUploadedFile = this.mediaService.createUploadedFile(file);
            console.log('Created uploaded file object:', this.editUploadedFile);
        }
    }

    /**
     * Remove selected edit file
     */
    removeEditFile(): void {
        this.editUploadedFile = null;
        
        // Reset file input
        const fileInput = document.getElementById('editFileInput') as HTMLInputElement;
        if (fileInput) {
            fileInput.value = '';
        }
    }

    /**
     * Save media changes
     */
    async saveMediaChanges(): Promise<void> {
        if (!this.editingMedia) {
            console.error('No media selected for editing');
            return;
        }

        console.log('Saving media changes...', {
            mediaId: this.editingMedia.id,
            newName: this.editMediaName.trim(),
            hasNewFile: !!this.editUploadedFile,
            originalName: this.editingMedia.media_name
        });

        this.editUploading = true;

        try {
            let updatedMedia: MediaModel;

            // If a new file is selected, upload it and update the media record
            if (this.editUploadedFile) {
                console.log('Updating media with new file...');
                updatedMedia = await this.updateMediaWithNewFile(
                    this.editingMedia.id,
                    this.editUploadedFile,
                    this.editMediaName.trim()
                );
            } else if (this.editMediaName.trim() !== this.editingMedia.media_name) {
                // If only the name changed, update the database record
                console.log('Updating media name only...');
                updatedMedia = await this.updateMediaName(this.editingMedia.id, this.editMediaName.trim());
            } else {
                // No changes made
                console.log('No changes detected, closing modal');
                this.modalService.dismissAll();
                this.resetEditState();
                return;
            }

            // Update local state
            const mediaIndex = this.basicData.findIndex(m => m.id === this.editingMedia!.id);
            if (mediaIndex !== -1) {
                this.basicData[mediaIndex] = updatedMedia;
                console.log('Updated local state at index:', mediaIndex);
            }

            // Close modal and reset state
            this.modalService.dismissAll();
            this.resetEditState();

            console.log('Media updated successfully:', updatedMedia);
            
            // Show success notification
            await Swal.fire({
                icon: 'success',
                title: 'Success!',
                text: 'Media has been updated successfully.',
                timer: 2000,
                showConfirmButton: false,
                toast: true,
                position: 'top-end'
            });

        } catch (error) {
            console.error('Error saving media changes:', error);
            await Swal.fire({
                icon: 'error',
                title: 'Save Failed',
                text: (error as any)?.message || 'Unknown error occurred while saving changes.',
                confirmButtonColor: '#d33'
            });
        } finally {
            this.editUploading = false;
        }
    }

    /**
     * Update media name in database
     */
    private async updateMediaName(mediaId: number, newName: string): Promise<MediaModel> {
        try {
            return await this.mediaService.updateMediaRecord(mediaId, { media_name: newName });
        } catch (error: any) {
            console.error('Failed to update media name:', error);
            throw new Error(`Failed to update media name: ${error.message || 'Unknown error'}`);
        }
    }

    /**
     * Update media with new file
     */
    private async updateMediaWithNewFile(mediaId: number, uploadedFile: UploadedFile, newName?: string): Promise<MediaModel> {
        const supabaseClient = this.mediaService['supabaseClient'];
        
        // Ensure we have a session (but don't fail if we don't, since RLS is disabled)
        try {
            const { data: { session } } = await supabaseClient.auth.getSession();
            console.log('Current session for file update:', session ? 'Active' : 'None');
        } catch (authError) {
            console.warn('Auth check failed, proceeding anyway:', authError);
        }
        
        // First, get the current media record to know the old file path
        const { data: currentMedia, error: fetchError } = await supabaseClient
            .from('media')
            .select('*')
            .eq('id', mediaId)
            .single();

        if (fetchError) {
            console.error('Error fetching current media:', fetchError);
            throw new Error(`Failed to fetch current media: ${fetchError.message}`);
        }

        // Upload the new file to storage
        const fileName = `${Date.now()}-${uploadedFile.file.name}`;
        const filePath = `public_images/${fileName}`;
        
        console.log('Uploading file to storage:', {
            bucket: 'medias',
            filePath: filePath,
            fileName: fileName,
            fileSize: uploadedFile.file.size,
            fileType: uploadedFile.file.type
        });
        
        uploadedFile.uploading = true;
        uploadedFile.progress = 0;

        const { data: uploadData, error: uploadError } = await supabaseClient.storage
            .from('medias')
            .upload(filePath, uploadedFile.file, {
                cacheControl: '3600',
                upsert: true  // Changed to true to allow overwriting
            });

        if (uploadError) {
            console.error('Storage upload error:', uploadError);
            uploadedFile.uploading = false;
            uploadedFile.error = uploadError.message;
            throw new Error(`Storage upload failed: ${uploadError.message}`);
        }

        console.log('Storage upload successful:', uploadData);

        uploadedFile.path = uploadData.path;
        uploadedFile.progress = 100;
        uploadedFile.uploading = false;

        // Get public URL for the new file
        const { data: urlData } = supabaseClient.storage
            .from('medias')
            .getPublicUrl(uploadData.path);

        uploadedFile.url = urlData.publicUrl;

        // Update the database record with new file path and optionally new name
        const updateData: any = {
            media_path: uploadData.path
        };

        if (newName && newName !== currentMedia.media_name) {
            updateData.media_name = newName;
        }

        const { data: updatedData, error: updateError } = await supabaseClient
            .from('media')
            .update(updateData)
            .eq('id', mediaId)
            .select()
            .single();

        if (updateError) {
            console.error('Database update error:', updateError);
            // Clean up the uploaded file if database update fails
            try {
                await supabaseClient.storage
                    .from('medias')
                    .remove([uploadData.path]);
            } catch (cleanupError) {
                console.error('Failed to cleanup uploaded file after database error:', cleanupError);
            }
            throw new Error(`Database update failed: ${updateError.message}`);
        }

        // Clean up the old file from storage if it exists
        if (currentMedia.media_path) {
            try {
                await supabaseClient.storage
                    .from('medias')
                    .remove([currentMedia.media_path]);
            } catch (cleanupError) {
                console.warn('Failed to clean up old file:', cleanupError);
                // Don't throw here as the main operation succeeded
            }
        }

        // Add URL to the updated media
        const updatedMedia = updatedData as MediaModel;
        updatedMedia.url = urlData.publicUrl;

        return updatedMedia;
    }

    /**
     * Reset edit state
     */
    resetEditState(): void {
        this.editingMedia = null;
        this.editMediaName = '';
        this.editUploadedFile = null;
        this.editUploading = false;
    }

    /**
     * Check if media is an image (based on database type column)
     */
    isImageMedia(media: MediaModel): boolean {
        return media.type === 'image';
    }

    /**
     * Check if media is a video (based on database type column)
     */
    isVideoMedia(media: MediaModel): boolean {
        return media.type === 'video';
    }

    /**
     * Get video preview thumbnail (for future enhancement)
     */
    getVideoThumbnail(media: MediaModel): string | null {
        // For now, return null. In the future, you could generate thumbnails
        return null;
    }

    /**
     * Open preview modal for media
     */
    openPreviewModal(media: MediaModel, modal: any): void {
        this.previewingMedia = media;
        this.modalService.open(modal, { size: 'xl', centered: true });
    }

    /**
     * Check if there are changes to save
     */
    hasChangesToSave(): boolean {
        if (!this.editingMedia) return false;
        
        // Check if name has changed
        const nameChanged = this.editMediaName.trim() !== (this.editingMedia.media_name || '');
        
        // Check if new file is selected
        const fileSelected = !!this.editUploadedFile;
        
        return nameChanged || fileSelected;
    }

    /**
     * Handle image loading errors
     */
    onImageError(event: any, media: MediaModel): void {
        console.error('Image failed to load:', {
            media: media,
            path: media.media_path,
            error: event
        });
        
        // Hide the broken image
        event.target.style.display = 'none';
    }

    /**
     * Get media URL from path using MediaService (same as index component)
     */
    getMediaUrl(media: MediaModel): string | null {
        if (!media.media_path || media.media_path.trim() === '') {
            /*console.log('No valid media_path for media:', {
                id: media.id, 
                name: media.media_name, 
                path: media.media_path,
                type: media.type
            });*/
            return null;
        }
        
        // Use the same method as index component
        const url = this.mediaService.getMediaUrl(media.media_path, 'medias');
        /*console.log('Generated URL for', media.media_name, ':', {
            path: media.media_path,
            url: url,
            type: media.type
        });*/
        return url;
    }

    /**
     * Create preview URL for file upload
     */
    createFilePreview(file: File): string {
        return URL.createObjectURL(file);
    }

    /**
     * Handle image load errors for upload previews
     */
    onImageLoadError(event: Event): void {
        const target = event.target as HTMLImageElement;
        if (target) {
            target.style.display = 'none';
        }
    }

    protected readonly document = document;
}
