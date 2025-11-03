
export interface MenuItem {
  id: number;
  categoria: string;
  nombre: string;
  precio: number;
  disponible: boolean;
}

export interface OrderItem {
  id: number;
  nombre: string;
  cantidad: number;
  precioUnitario: number;
}
