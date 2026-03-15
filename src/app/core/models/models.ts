import {Component} from "@angular/core";

export interface Client {
    id: string; // UUID
    email: string;
    password?: string; // Jamais stocké côté frontend !
    nom: string;
    prenom: string;
    telephone?: string;
    adresse_id?: string; // Clé étrangère vers Adresse
    created_at?: Date;
}

export interface Photo {
    id: string;
    bucket_path: string;
    file_name: string;
    size?: number;
    created_at?: Date;
}

export interface Adresse {
    id: string; // UUID
    client_id?: string; // Lié au client
    ligne1: string;
    ligne2?: string;
    ville: string;
    code_postal: string;
    pays_id?: string;
    created_at?: Date;
}

export interface Pays {
    id: string; // UUID
    nom: string;
    drapeau?: string; // URL de l'image du drapeau
}

export interface Produit {
    id: string; // UUID
    nom: string;
    description?: string;
    prix: number;
    sous_categorie_id?: string;
    created_at?: Date;
    front_photo_path?: string;
    back_photo_path?: string;
    is_best_seller?: boolean;
    is_new?: boolean;
    // Visibility (admin only - not in products_public)
    is_hidden?: boolean;
    publish_at?: string; // ISO timestamptz UTC
    unpublish_at?: string; // ISO timestamptz UTC
}

export interface Taille {
    id: string; // UUID
    libelle: string; // ex: "S", "M", "L", "XL"
}

export interface Colors {
    id: number; // ID de la couleur (bigint dans la base de données)
    nom?: string;
    hex: string;
    red?: number;
    green?: number;
    blue?: number;
    hue?: number;
    sat_hsl?: number;
    light_hsl?: number;
    sat_hsv?: number;
    val_hsv?: number;
    source?: string;
}

export interface Variant {
    id: string;
    produit_id?: string;
    taille_id?: string;
    couleur_id?: number;
    stock: number;
    // Note: Price is stored on product, not variant
    created_at?: Date;
    others_photos?: string[];
    main_photo_path?: string[];
    is_primary?: boolean;
    // Relations (joined data)
    taille?: Taille;
    colors?: Colors;
}

// ProduitVariation is now an alias for Variant to maintain compatibility
export type ProduitVariation = Variant & {
    produitId?: string; // Compatibility field
    tailleId?: string; // Compatibility field
    couleurId?: string | number; // Compatibility field
    principal_photo_id?: string; // Compatibility field for existing code
    photos?: Photo; // Compatibility field
};


export interface Panier {
    id: string; // UUID
    client_id?: string;
    created_at?: Date;
}

export interface PanierItem {
    id: string; // UUID
    panier_id?: string;
    produit_id?: string;
    couleur_id?: string;
    taille_id?: string;
    quantite: number;
}

export interface Commande {
    id: string; // UUID
    client_id?: string;
    adresse_livraison_id?: string;
    adresse_facturation_id?: string;
    statut?: string; // 'Nouvelle' | 'PENDING' | 'PAID' | 'FAILED' | 'En cours' | 'Expédiée' | 'Livrée' | 'Annulée'
    total: number;
    created_at?: Date;
    payment_reference?: string;
    payment_data?: any;
    // Order number (generated on payment success, e.g. S&M-FR-00000001)
    order_number?: string;
    locale?: string;
    // Country / currency (persisted at order creation)
    country_code?: string; // 'FR' | 'CI'
    currency?: string;     // 'EUR' | 'XOF' | 'USD'
    exchange_rate_eur_to_xof?: number;
    // Shipping / delivery
    shipping_zone_code?: string;
    shipping_cost?: number;
    express_delivery?: boolean;
    express_cost?: number;
    server_computed_total?: number;
    // Invoice
    invoice_pdf_path?: string;
    invoice_last_sent_at?: string;
    // Shipping/Tracking info
    tracking_code?: string;
    shipping_carrier?: string;
    shipped_at?: Date | string;
    // Relations (joined data)
    client?: Client;
    items?: CommandeItem[];
}


export interface CommandeItem {
    id: string; // UUID
    commande_id?: string;
    produit_variation_id?: string;
    quantite: number;
    prix_unitaire: number;
}


export interface Livraison {
    id: string; // UUID
    commande_id?: string;
    transporteur: string; // ex: "Colissimo", "Chronopost"
    numero_suivi?: string;
    date_expedition?: Date;
    date_livraison?: Date;
}


export interface ListeFavoris {
    id: string; // UUID
    client_id?: string;
    produit_id?: string;
    created_at?: Date;
}

export interface ProduitPhoto {
    id: string;
    produit_id: string;
    nom: string;
    photo_id: string;
    second_photo_id: string;
    is_primary: boolean;
    display_order: number;
    created_at: Date;
    photo?: Photo;
}




export interface Categorie {
    id: string; // UUID
    nom?: string;
    image?: string;
    parent_id?: string; // UUID - reference to parent category
    created_at?: Date;
}

export interface Couleur {
    id: string; // UUID
    nom: string;
    code_hex: string;
}

export interface BestSellers {
    id: number; // bigint - auto increment
    created_at: Date;
    produit_id?: string;
}

export interface Admin {
    id: number; // bigint from database
    username: string;
    password?: string; // Optional for security
}