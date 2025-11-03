
import React from 'react';
import { OrderItem } from '../types';

interface OrderSummaryProps {
    order: OrderItem[];
    onClear: () => void;
}

const OrderSummary: React.FC<OrderSummaryProps> = ({ order, onClear }) => {
    const total = order.reduce((sum, item) => sum + item.cantidad * item.precioUnitario, 0);

    return (
        <div className="w-full max-w-md mx-auto bg-white p-6 rounded-2xl shadow-lg mt-8 animate-fade-in">
            <h3 className="text-2xl font-bold text-gray-800 mb-4 text-center">Resumen del Pedido</h3>
            <div className="space-y-3">
                {order.map((item) => (
                    <div key={item.id} className="flex justify-between items-center text-gray-700 border-b pb-2">
                        <div>
                            <p className="font-semibold">{item.nombre}</p>
                            <p className="text-sm text-gray-500">{item.cantidad} x ${item.precioUnitario.toLocaleString('es-AR')}</p>
                        </div>
                        <p className="font-bold text-lg">${(item.cantidad * item.precioUnitario).toLocaleString('es-AR')}</p>
                    </div>
                ))}
            </div>
            <div className="flex justify-between items-center mt-6 pt-4 border-t-2 border-dashed">
                <span className="text-xl font-bold text-gray-800">Total:</span>
                <span className="text-2xl font-extrabold text-amber-800">${total.toLocaleString('es-AR')}</span>
            </div>
             <button
                onClick={onClear}
                className="w-full mt-6 bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-lg transition-colors duration-300"
            >
                Nuevo Pedido
            </button>
        </div>
    );
};

export default OrderSummary;
