CREATE TABLE `escaneos` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`codigo_caja` text NOT NULL,
	`codigo_escaneado` text NOT NULL,
	`descripcion` text NOT NULL,
	`caracteristicas` text DEFAULT '' NOT NULL,
	`departamento` text NOT NULL,
	`categoria` text NOT NULL,
	`precio` real DEFAULT 0 NOT NULL,
	`ubicacion` text DEFAULT '' NOT NULL,
	`usuario` text NOT NULL,
	`fecha_escaneo` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `productos` (
	`clave` text PRIMARY KEY NOT NULL,
	`descripcion` text NOT NULL,
	`caracteristicas` text DEFAULT '' NOT NULL,
	`departamento` text NOT NULL,
	`categoria` text NOT NULL,
	`precio` real DEFAULT 0 NOT NULL,
	`existencia_sicarx` integer DEFAULT 0 NOT NULL
);
