-- Table Pays
create table pays (
  id uuid primary key default gen_random_uuid(),
  nom text not null,
  drapeau text -- URL de l'image du drapeau
);

-- Table Adresse
create table adresse (
     id uuid primary key default gen_random_uuid(),
     client_id uuid references client(id) on delete cascade,
     ligne1 text not null,
     ligne2 text,
     ville text not null,
     code_postal text not null,
     pays_id uuid references pays(id),
     created_at timestamp with time zone default timezone('utc'::text, now())
);

-- Table Client
create table client (
    id uuid primary key default gen_random_uuid(),
    nom text not null,
    prenom text not null,
    email text not null unique,
    telephone text,
    adresse_id uuid references adresse(id)
    created_at timestamp with time zone default timezone('utc'::text, now())
);

-- Table Taille
create table taille (
    id uuid primary key default gen_random_uuid(),
    libelle text not null
);

-- Table Couleur
create table couleur (
     id uuid primary key default gen_random_uuid(),
     nom text not null,
     code_hex text not null
);

-- Table Produit
create table produit (
     id uuid primary key default gen_random_uuid(),
     nom text not null,
     description text,
     prix decimal(10,2) not null,
     image_url text,
     tailles uuid[] references taille(id), -- tableau d'ID de tailles
     couleurs uuid[] references couleur(id), -- tableau d'ID de couleurs
     created_at timestamp with time zone default timezone('utc'::text, now())
);

-- Table Panier
create table panier (
    id uuid primary key default gen_random_uuid(),
    client_id uuid references client(id) on delete cascade,
    created_at timestamp with time zone default timezone('utc'::text, now())
);

-- Table PanierItem
create table panier_item (
     id uuid primary key default gen_random_uuid(),
     panier_id uuid references panier(id) on delete cascade,
     produit_id uuid references produit(id) on delete cascade,
     couleur_id uuid references couleur(id),
     taille_id uuid references taille(id),
     quantite integer not null default 1
);

-- Table ListeFavoris
create table liste_favoris (
       id uuid primary key default gen_random_uuid(),
       client_id uuid references client(id) on delete cascade,
       produit_id uuid references produit(id) on delete cascade,
       created_at timestamp with time zone default timezone('utc'::text, now()),
       unique (client_id, produit_id) -- empêcher doublons
);

-- Table Commande
create table commande (
      id uuid primary key default gen_random_uuid(),
      client_id uuid references client(id) on delete cascade,
      adresse_livraison_id uuid references adresse(id),
      adresse_facturation_id uuid references adresse(id),
      statut text default 'en_attente', -- en_attente, payé, expédié, livré, annulé
      total decimal(10,2) not null,
      created_at timestamp with time zone default timezone('utc'::text, now())
);

-- Table CommandeItem
create table commande_item (
       id uuid primary key default gen_random_uuid(),
       commande_id uuid references commande(id) on delete cascade,
       produit_variation_id uuid references produit_variation(id) on delete cascade,
       quantite integer not null,
       prix_unitaire decimal(10,2) not null
);

create table produit_variation (
       id uuid primary key default gen_random_uuid(),
       produit_id uuid references produit(id) on delete cascade,
       taille_id uuid references taille(id),
       couleur_id uuid references couleur(id),
       stock integer not null default 0
);

-- Table Livraison
create table livraison (
       id uuid primary key default gen_random_uuid(),
       commande_id uuid references commande(id) on delete cascade,
       transporteur text not null,
       numero_suivi text,
       date_expedition timestamp with time zone,
       date_livraison timestamp with time zone
);
