const DEFAULT_ROLES = [
  { name: "Admin", description: "Acceso total al sistema" },
  { name: "Secretaria", description: "Gestión documentaria" },
  { name: "Presidente", description: "Aprobaciones y supervisiones" },
  { name: "Asistente", description: "Soporte operativo" },
  { name: "Supervisor", description: "Supervisión de procesos" },
  { name: "SuperAdmin", description: "Super administrador del sistema" },
  { name: "AtencionCliente", description: "Atención operativa de solicitudes" },
  { name: "Ingeniero", description: "Gestión técnica y certificaciones" },
];

async function seedRoles(prisma) {
  for (const role of DEFAULT_ROLES) {
    await prisma.role.upsert({
      where: { name: role.name },
      create: role,
      update: {},
    });
    console.log(`  ✓ Rol "${role.name}"`);
  }
}

module.exports = { seedRoles };
