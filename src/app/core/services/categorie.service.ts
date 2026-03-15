import { Injectable } from '@angular/core';
import { Categorie } from '../models/models';
import { SupabaseService } from './supabase.service';
import { from, Observable, throwError } from "rxjs";
import { catchError, map } from "rxjs/operators";

@Injectable({
  providedIn: 'root'
})
export class CategorieService {
  private tableName = 'categorie';

  constructor(private supabaseService: SupabaseService) {}

  getCategories(): Observable<Categorie[]> {
    return from(
      this.supabaseService.getClient()
        .from('categorie')
        .select('*')
        .order('ordre')
    ).pipe(
      map(({ data, error }) => {
        if (error) throw error;
        return data as Categorie[]
      }),
      catchError(error => throwError(() => error))
    );
  }

  getCategorieById(id: string): Observable<Categorie> {
    return from(
      this.supabaseService.getClient()
        .from(this.tableName)
        .select('*')
        .eq('id', id)
        .single()
    ).pipe(
      map(({ data, error }) => {
        if (error) throw error;
        const categorie = data as Categorie;
        return {
          ...categorie,
          name: categorie.nom,
        };
      }),
      catchError(error => throwError(() => error))
    );
  }

  getCategoriesActives(): Observable<Categorie[]> {
    return from(
      this.supabaseService.getClient()
        .from(this.tableName)
        .select('*')
        .eq('actif', true)
        .order('nom')
    ).pipe(
      map(({ data, error }) => {
        if (error) throw error;
        return (data as Categorie[]).map(categorie => ({
          ...categorie,
          name: categorie.nom,
          sellername: `Admin de ${categorie.nom}`,
          stock: '0',
          ballence: '$0',
          category: categorie.nom,
          ternding: Math.random() > 0.7, // Random trending for variety
          chart: this.getDefaultChart()
        }));
      }),
      catchError(error => throwError(() => error))
    );
  }

  createCategorie(categorie: Omit<Categorie, 'id'>): Observable<Categorie> {
    return from(
      this.supabaseService.getClient()
        .from(this.tableName)
        .insert([{
          nom: categorie.nom,
          image: categorie.image,
          parent_id: categorie.parent_id || null
        }])
        .select()
        .single()
    ).pipe(
      map(({ data, error }) => {
        if (error) throw error;
        return data as Categorie;
      }),
      catchError(error => throwError(() => error))
    );
  }

  updateCategorie(id: string, categorie: Partial<Categorie>): Observable<Categorie> {
    const updateData: any = {};
    
    if (categorie.nom !== undefined) updateData.nom = categorie.nom;
    if (categorie.image !== undefined) updateData.image = categorie.image;
    if (categorie.parent_id !== undefined) updateData.parent_id = categorie.parent_id;
    
    return from(
      this.supabaseService.getClient()
        .from(this.tableName)
        .update(updateData)
        .eq('id', id)
        .select()
        .maybeSingle()
    ).pipe(
      map(({ data, error }) => {
        if (error) throw error;
        if (!data) throw new Error('Catégorie introuvable ou mise à jour non autorisée');
        return data as Categorie;
      }),
      catchError(error => throwError(() => error))
    );
  }

  deleteCategorie(id: string): Observable<void> {
    return from(
      this.supabaseService.getClient()
        .from(this.tableName)
        .delete()
        .eq('id', id)
    ).pipe(
      map(({ error }) => {
        if (error) throw error;
      }),
      catchError(error => throwError(() => error))
    );
  }

  searchCategories(searchTerm: string): Observable<Categorie[]> {
    return from(
      this.supabaseService.getClient()
        .from(this.tableName)
        .select('*')
        .eq('actif', true)
        .ilike('nom', `%${searchTerm}%`)
        .order('nom')
    ).pipe(
      map(({ data, error }) => {
        if (error) throw error;
        return (data as Categorie[]).map(categorie => ({
          ...categorie,
          name: categorie.nom,
          sellername: `Admin de ${categorie.nom}`,
          stock: '0',
          ballence: '$0',
          category: categorie.nom,
          ternding: Math.random() > 0.7,
          chart: this.getDefaultChart()
        }));
      }),
      catchError(error => throwError(() => error))
    );
  }

  /**
   * Get subcategories by parent category ID
   */
  getSubcategoriesByParentId(parentId: string): Observable<Categorie[]> {
    return from(
      this.supabaseService.getClient()
        .from(this.tableName)
        .select('*')
        .eq('parent_id', parentId)
        .order('nom')
    ).pipe(
      map(({ data, error }) => {
        if (error) throw error;
        return data as Categorie[];
      }),
      catchError(error => throwError(() => error))
    );
  }

  private getDefaultChart() {
    // Generate random data for chart
    const randomData = Array.from({ length: 11 }, () => Math.floor(Math.random() * 80) + 10);
    const colors = ['#f06548', '#0AB39C', '#F7B84B'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];

    return {
      series: [{
        data: randomData,
      }],
      chart: {
        type: "area",
        height: 50,
        sparkline: {
          enabled: true,
        },
      },
      fill: {
        type: "gradient",
        gradient: {
          shadeIntensity: 1,
          inverseColors: false,
          opacityFrom: 0.45,
          opacityTo: 0.05,
          stops: [20, 100, 100, 100],
        },
      },
      stroke: {
        curve: "smooth",
        width: 2,
      },
      tooltip: {
        fixed: {
          enabled: false,
        },
        x: {
          show: false,
        },
        y: {
          title: {
            formatter: function (seriesName: string) {
              return "";
            },
          },
        },
        marker: {
          show: false,
        },
      },
      colors: [randomColor],
      dataLabels: {
        enabled: false,
      }
    };
  }
}