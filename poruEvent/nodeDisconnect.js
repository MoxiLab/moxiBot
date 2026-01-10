module.exports = (client, node, reason) => { 
    console.log(`[ALERTA] El nodo ${node.options.identifier} se ha desconectado. Razón: ${JSON.stringify(reason)}`.red);

    // 2. IMPORTANTE: NO pongas player.destroy() aquí si quieres que intente volver.
    // Si destruyes el player, pierdes la cola y la configuración de la canción actual.
    
    // 3. Intento de reconexión manual (si tu librería no lo hace sola):
    console.log(`[INFO] Intentando reconectar nodo ${node.options.identifier} en 5 segundos...`.yellow);
    setTimeout(() => {
        if (!node.connected) {
            node.connect(); // Fuerza un intento de conexión
        }
    }, 5000);
};