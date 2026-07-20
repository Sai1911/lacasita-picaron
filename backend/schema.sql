-- MySQL Workbench Forward Engineering

SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0;
SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0;
SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION';

-- -----------------------------------------------------
-- Schema mydb
-- -----------------------------------------------------
-- -----------------------------------------------------
-- Schema lacasitadpicaron
-- -----------------------------------------------------
DROP SCHEMA IF EXISTS `lacasitadpicaron` ;

-- -----------------------------------------------------
-- Schema lacasitadpicaron
-- -----------------------------------------------------
CREATE SCHEMA IF NOT EXISTS `lacasitadpicaron` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci ;
-- -----------------------------------------------------
-- Schema pos_tienda
-- -----------------------------------------------------
DROP SCHEMA IF EXISTS `pos_tienda` ;

-- -----------------------------------------------------
-- Schema pos_tienda
-- -----------------------------------------------------
CREATE SCHEMA IF NOT EXISTS `pos_tienda` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci ;
USE `lacasitadpicaron` ;

-- -----------------------------------------------------
-- Table `lacasitadpicaron`.`caja`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `lacasitadpicaron`.`caja` (
  `id_caja` INT NOT NULL AUTO_INCREMENT,
  `nombre_caja` VARCHAR(20) NOT NULL,
  `turno` VARCHAR(20) NULL DEFAULT NULL,
  `estado` VARCHAR(20) NULL DEFAULT 'Cerrada',
  `saldo_inicial` DECIMAL(10,2) NOT NULL,
  PRIMARY KEY (`id_caja`))
ENGINE = InnoDB
DEFAULT CHARACTER SET = utf8mb4
COLLATE = utf8mb4_0900_ai_ci;


-- -----------------------------------------------------
-- Table `lacasitadpicaron`.`cliente`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `lacasitadpicaron`.`cliente` (
  `id_cliente` INT NOT NULL AUTO_INCREMENT,
  `nombre` VARCHAR(100) NOT NULL,
  `dni_ruc` VARCHAR(11) NULL DEFAULT NULL,
  `telefono` VARCHAR(15) NULL DEFAULT NULL,
  `correo` VARCHAR(100) NULL DEFAULT NULL,
  PRIMARY KEY (`id_cliente`))
ENGINE = InnoDB
DEFAULT CHARACTER SET = utf8mb4
COLLATE = utf8mb4_0900_ai_ci;


-- -----------------------------------------------------
-- Table `lacasitadpicaron`.`personal`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `lacasitadpicaron`.`personal` (
  `id_personal` INT NOT NULL AUTO_INCREMENT,
  `nombre` VARCHAR(50) NOT NULL,
  `apellido` VARCHAR(50) NOT NULL,
  `dni` VARCHAR(8) NOT NULL,
  `codigo_acceso` VARCHAR(20) NOT NULL,
  `password_hash` VARCHAR(255) NOT NULL,
  `intentos_fallidos` INT NULL DEFAULT '0',
  `cargo` ENUM('Mozo', 'Cocina', 'Caja', 'Admin') NOT NULL,
  `salario` DECIMAL(10,2) NULL DEFAULT '0.00',
  `estado` VARCHAR(20) NULL DEFAULT 'activo',
  PRIMARY KEY (`id_personal`))
ENGINE = InnoDB
AUTO_INCREMENT = 5
DEFAULT CHARACTER SET = utf8mb4
COLLATE = utf8mb4_0900_ai_ci;

CREATE UNIQUE INDEX `dni` ON `lacasitadpicaron`.`personal` (`dni` ASC) VISIBLE;

CREATE UNIQUE INDEX `codigo_acceso` ON `lacasitadpicaron`.`personal` (`codigo_acceso` ASC) VISIBLE;


-- -----------------------------------------------------
-- Table `lacasitadpicaron`.`mesa`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `lacasitadpicaron`.`mesa` (
  `id_mesa` INT NOT NULL AUTO_INCREMENT,
  `numero_mesa` VARCHAR(10) NOT NULL,
  `estado` ENUM('Disponible', 'Ocupada', 'Por pagar') NULL DEFAULT 'Disponible',
  `id_personal_asignado` INT NULL DEFAULT NULL,
  PRIMARY KEY (`id_mesa`),
  CONSTRAINT `mesa_ibfk_1`
    FOREIGN KEY (`id_personal_asignado`)
    REFERENCES `lacasitadpicaron`.`personal` (`id_personal`))
ENGINE = InnoDB
AUTO_INCREMENT = 31
DEFAULT CHARACTER SET = utf8mb4
COLLATE = utf8mb4_0900_ai_ci;

CREATE INDEX `id_personal_asignado` ON `lacasitadpicaron`.`mesa` (`id_personal_asignado` ASC) VISIBLE;


-- -----------------------------------------------------
-- Table `lacasitadpicaron`.`pago`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `lacasitadpicaron`.`pago` (
  `id_pago` INT NOT NULL AUTO_INCREMENT,
  `monto_total` DECIMAL(10,2) NOT NULL,
  `metodo_pago` VARCHAR(20) NOT NULL,
  `fecha_pago` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_pago`))
ENGINE = InnoDB
AUTO_INCREMENT = 4
DEFAULT CHARACTER SET = utf8mb4
COLLATE = utf8mb4_0900_ai_ci;


-- -----------------------------------------------------
-- Table `lacasitadpicaron`.`comanda`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `lacasitadpicaron`.`comanda` (
  `id_comanda` INT NOT NULL AUTO_INCREMENT,
  `fecha_hora` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `estado` ENUM('Pendiente', 'Finalizada', 'Pagada', 'Anulada') NULL DEFAULT 'Pendiente',
  `id_personal` INT NOT NULL,
  `id_mesa` INT NOT NULL,
  `id_cliente` INT NULL DEFAULT NULL,
  `id_pago` INT NULL DEFAULT NULL,
  PRIMARY KEY (`id_comanda`),
  CONSTRAINT `comanda_ibfk_1`
    FOREIGN KEY (`id_personal`)
    REFERENCES `lacasitadpicaron`.`personal` (`id_personal`),
  CONSTRAINT `comanda_ibfk_2`
    FOREIGN KEY (`id_mesa`)
    REFERENCES `lacasitadpicaron`.`mesa` (`id_mesa`),
  CONSTRAINT `comanda_ibfk_3`
    FOREIGN KEY (`id_cliente`)
    REFERENCES `lacasitadpicaron`.`cliente` (`id_cliente`),
  CONSTRAINT `comanda_ibfk_4`
    FOREIGN KEY (`id_pago`)
    REFERENCES `lacasitadpicaron`.`pago` (`id_pago`))
ENGINE = InnoDB
DEFAULT CHARACTER SET = utf8mb4
COLLATE = utf8mb4_0900_ai_ci;

CREATE INDEX `id_personal` ON `lacasitadpicaron`.`comanda` (`id_personal` ASC) VISIBLE;

CREATE INDEX `id_mesa` ON `lacasitadpicaron`.`comanda` (`id_mesa` ASC) VISIBLE;

CREATE INDEX `id_cliente` ON `lacasitadpicaron`.`comanda` (`id_cliente` ASC) VISIBLE;

CREATE INDEX `id_pago` ON `lacasitadpicaron`.`comanda` (`id_pago` ASC) VISIBLE;


-- -----------------------------------------------------
-- Table `lacasitadpicaron`.`comprobante_pago`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `lacasitadpicaron`.`comprobante_pago` (
  `id_comprobante` INT NOT NULL AUTO_INCREMENT,
  `tipo_comprobante` VARCHAR(20) NOT NULL,
  `numero_comprobante` VARCHAR(20) NOT NULL,
  `fecha_emision` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `id_pago` INT NOT NULL,
  PRIMARY KEY (`id_comprobante`),
  CONSTRAINT `comprobante_pago_ibfk_1`
    FOREIGN KEY (`id_pago`)
    REFERENCES `lacasitadpicaron`.`pago` (`id_pago`))
ENGINE = InnoDB
DEFAULT CHARACTER SET = utf8mb4
COLLATE = utf8mb4_0900_ai_ci;

CREATE INDEX `id_pago` ON `lacasitadpicaron`.`comprobante_pago` (`id_pago` ASC) VISIBLE;


-- -----------------------------------------------------
-- Table `lacasitadpicaron`.`platillo`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `lacasitadpicaron`.`platillo` (
  `id_platillo` INT NOT NULL AUTO_INCREMENT,
  `nombre` VARCHAR(100) NOT NULL,
  `descripcion` VARCHAR(255) NULL DEFAULT NULL,
  `categoria` ENUM('Calientes', 'Frias', 'Parrilla', 'Entradas', 'Postres', 'Bebidas') NOT NULL,
  `precio` DECIMAL(10,2) NOT NULL,
  `disponibilidad` TINYINT(1) NULL DEFAULT '1',
  PRIMARY KEY (`id_platillo`))
ENGINE = InnoDB
AUTO_INCREMENT = 17
DEFAULT CHARACTER SET = utf8mb4
COLLATE = utf8mb4_0900_ai_ci;


-- -----------------------------------------------------
-- Table `lacasitadpicaron`.`detalle_comanda`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `lacasitadpicaron`.`detalle_comanda` (
  `id_detalle` INT NOT NULL AUTO_INCREMENT,
  `id_comanda` INT NOT NULL,
  `id_platillo` INT NOT NULL,
  `cantidad` INT NOT NULL,
  `precio_unitario` DECIMAL(10,2) NOT NULL,
  `nota` VARCHAR(255) NULL DEFAULT NULL,
  PRIMARY KEY (`id_detalle`),
  CONSTRAINT `detalle_comanda_ibfk_1`
    FOREIGN KEY (`id_comanda`)
    REFERENCES `lacasitadpicaron`.`comanda` (`id_comanda`),
  CONSTRAINT `detalle_comanda_ibfk_2`
    FOREIGN KEY (`id_platillo`)
    REFERENCES `lacasitadpicaron`.`platillo` (`id_platillo`))
ENGINE = InnoDB
DEFAULT CHARACTER SET = utf8mb4
COLLATE = utf8mb4_0900_ai_ci;

CREATE INDEX `id_comanda` ON `lacasitadpicaron`.`detalle_comanda` (`id_comanda` ASC) VISIBLE;

CREATE INDEX `id_platillo` ON `lacasitadpicaron`.`detalle_comanda` (`id_platillo` ASC) VISIBLE;


-- -----------------------------------------------------
-- Table `lacasitadpicaron`.`logsesion`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `lacasitadpicaron`.`logsesion` (
  `id_log` INT NOT NULL AUTO_INCREMENT,
  `id_personal` INT NOT NULL,
  `fecha_hora_inicio` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `fecha_hora_cierre` DATETIME NULL DEFAULT NULL,
  `tipo_evento` VARCHAR(20) NULL DEFAULT NULL,
  PRIMARY KEY (`id_log`),
  CONSTRAINT `logsesion_ibfk_1`
    FOREIGN KEY (`id_personal`)
    REFERENCES `lacasitadpicaron`.`personal` (`id_personal`))
ENGINE = InnoDB
AUTO_INCREMENT = 24
DEFAULT CHARACTER SET = utf8mb4
COLLATE = utf8mb4_0900_ai_ci;

CREATE INDEX `id_personal` ON `lacasitadpicaron`.`logsesion` (`id_personal` ASC) VISIBLE;


-- -----------------------------------------------------
-- Table `lacasitadpicaron`.`pedidos`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `lacasitadpicaron`.`pedidos` (
  `id_pedido` INT NOT NULL AUTO_INCREMENT,
  `id_mesa` INT NULL DEFAULT NULL,
  `id_personal` INT NULL DEFAULT NULL,
  `total` DECIMAL(10,2) NULL DEFAULT NULL,
  `estado` ENUM('pendiente', 'listo', 'servido', 'por_pagar', 'pagado') NULL DEFAULT 'pendiente',
  `nombre_cliente` VARCHAR(100) NULL DEFAULT NULL,
  `doc_cliente` VARCHAR(20) NULL DEFAULT NULL,
  `tipo_doc` ENUM('boleta', 'factura') NULL DEFAULT NULL,
  `items_json` TEXT NULL DEFAULT NULL,
  `fecha_creacion` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_pedido`),
  CONSTRAINT `pedidos_ibfk_1`
    FOREIGN KEY (`id_mesa`)
    REFERENCES `lacasitadpicaron`.`mesa` (`id_mesa`),
  CONSTRAINT `pedidos_ibfk_2`
    FOREIGN KEY (`id_personal`)
    REFERENCES `lacasitadpicaron`.`personal` (`id_personal`))
ENGINE = InnoDB
AUTO_INCREMENT = 11
DEFAULT CHARACTER SET = utf8mb4
COLLATE = utf8mb4_0900_ai_ci;

CREATE INDEX `id_mesa` ON `lacasitadpicaron`.`pedidos` (`id_mesa` ASC) VISIBLE;

CREATE INDEX `id_personal` ON `lacasitadpicaron`.`pedidos` (`id_personal` ASC) VISIBLE;


-- -----------------------------------------------------
-- Table `lacasitadpicaron`.`reportecierre`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `lacasitadpicaron`.`reportecierre` (
  `id_reporte` INT NOT NULL AUTO_INCREMENT,
  `id_personal` INT NOT NULL,
  `id_caja` INT NOT NULL,
  `fecha_cierre` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `total_ingresos` DECIMAL(10,2) NOT NULL,
  `total_egresos` DECIMAL(10,2) NOT NULL,
  `saldo_final` DECIMAL(10,2) NOT NULL,
  `observacion` VARCHAR(255) NULL DEFAULT NULL,
  PRIMARY KEY (`id_reporte`),
  CONSTRAINT `reportecierre_ibfk_1`
    FOREIGN KEY (`id_personal`)
    REFERENCES `lacasitadpicaron`.`personal` (`id_personal`),
  CONSTRAINT `reportecierre_ibfk_2`
    FOREIGN KEY (`id_caja`)
    REFERENCES `lacasitadpicaron`.`caja` (`id_caja`))
ENGINE = InnoDB
DEFAULT CHARACTER SET = utf8mb4
COLLATE = utf8mb4_0900_ai_ci;

CREATE INDEX `id_personal` ON `lacasitadpicaron`.`reportecierre` (`id_personal` ASC) VISIBLE;

CREATE INDEX `id_caja` ON `lacasitadpicaron`.`reportecierre` (`id_caja` ASC) VISIBLE;

USE `pos_tienda` ;

-- -----------------------------------------------------
-- Table `pos_tienda`.`categorias`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `pos_tienda`.`categorias` (
  `id_categoria` INT NOT NULL AUTO_INCREMENT,
  `nombre` VARCHAR(100) NOT NULL,
  PRIMARY KEY (`id_categoria`))
ENGINE = InnoDB
AUTO_INCREMENT = 4
DEFAULT CHARACTER SET = utf8mb4
COLLATE = utf8mb4_0900_ai_ci;


-- -----------------------------------------------------
-- Table `pos_tienda`.`clientes`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `pos_tienda`.`clientes` (
  `id_cliente` INT NOT NULL AUTO_INCREMENT,
  `nombre_cliente` VARCHAR(150) NOT NULL,
  `informacion_contacto` VARCHAR(200) NULL DEFAULT NULL,
  PRIMARY KEY (`id_cliente`))
ENGINE = InnoDB
AUTO_INCREMENT = 3
DEFAULT CHARACTER SET = utf8mb4
COLLATE = utf8mb4_0900_ai_ci;


-- -----------------------------------------------------
-- Table `pos_tienda`.`empleados`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `pos_tienda`.`empleados` (
  `id_empleado` INT NOT NULL AUTO_INCREMENT,
  `nombre` VARCHAR(100) NOT NULL,
  `apellido` VARCHAR(100) NOT NULL,
  `dni` VARCHAR(15) NOT NULL,
  `cargo` VARCHAR(50) NOT NULL,
  PRIMARY KEY (`id_empleado`))
ENGINE = InnoDB
AUTO_INCREMENT = 3
DEFAULT CHARACTER SET = utf8mb4
COLLATE = utf8mb4_0900_ai_ci;

CREATE UNIQUE INDEX `uq_empleados_dni` ON `pos_tienda`.`empleados` (`dni` ASC) VISIBLE;


-- -----------------------------------------------------
-- Table `pos_tienda`.`proveedores`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `pos_tienda`.`proveedores` (
  `id_proveedor` INT NOT NULL AUTO_INCREMENT,
  `nombre_proveedor` VARCHAR(150) NOT NULL,
  PRIMARY KEY (`id_proveedor`))
ENGINE = InnoDB
AUTO_INCREMENT = 3
DEFAULT CHARACTER SET = utf8mb4
COLLATE = utf8mb4_0900_ai_ci;


-- -----------------------------------------------------
-- Table `pos_tienda`.`productos`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `pos_tienda`.`productos` (
  `id_producto` INT NOT NULL AUTO_INCREMENT,
  `nombre_producto` VARCHAR(150) NOT NULL,
  `precio_unitario` DECIMAL(10,2) NOT NULL,
  `stock` INT NOT NULL,
  `codigo_barra` VARCHAR(50) NOT NULL,
  `id_categoria` INT NOT NULL,
  `id_proveedor` INT NOT NULL,
  PRIMARY KEY (`id_producto`),
  CONSTRAINT `fk_productos_categorias`
    FOREIGN KEY (`id_categoria`)
    REFERENCES `pos_tienda`.`categorias` (`id_categoria`)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,
  CONSTRAINT `fk_productos_proveedores`
    FOREIGN KEY (`id_proveedor`)
    REFERENCES `pos_tienda`.`proveedores` (`id_proveedor`)
    ON DELETE RESTRICT
    ON UPDATE CASCADE)
ENGINE = InnoDB
AUTO_INCREMENT = 4
DEFAULT CHARACTER SET = utf8mb4
COLLATE = utf8mb4_0900_ai_ci;

CREATE UNIQUE INDEX `uq_productos_codigobarra` ON `pos_tienda`.`productos` (`codigo_barra` ASC) VISIBLE;

CREATE INDEX `fk_productos_categorias` ON `pos_tienda`.`productos` (`id_categoria` ASC) VISIBLE;

CREATE INDEX `fk_productos_proveedores` ON `pos_tienda`.`productos` (`id_proveedor` ASC) VISIBLE;


-- -----------------------------------------------------
-- Table `pos_tienda`.`ventas`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `pos_tienda`.`ventas` (
  `id_venta` INT NOT NULL AUTO_INCREMENT,
  `fecha_hora` DATETIME NOT NULL,
  `total_bruto` DECIMAL(10,2) NOT NULL,
  `total_neto` DECIMAL(10,2) NOT NULL,
  `es_devolucion` CHAR(1) NOT NULL,
  `id_empleado` INT NOT NULL,
  `id_cliente` INT NULL DEFAULT NULL,
  PRIMARY KEY (`id_venta`),
  CONSTRAINT `fk_ventas_clientes`
    FOREIGN KEY (`id_cliente`)
    REFERENCES `pos_tienda`.`clientes` (`id_cliente`)
    ON DELETE SET NULL
    ON UPDATE CASCADE,
  CONSTRAINT `fk_ventas_empleados`
    FOREIGN KEY (`id_empleado`)
    REFERENCES `pos_tienda`.`empleados` (`id_empleado`)
    ON DELETE RESTRICT
    ON UPDATE CASCADE)
ENGINE = InnoDB
AUTO_INCREMENT = 3
DEFAULT CHARACTER SET = utf8mb4
COLLATE = utf8mb4_0900_ai_ci;

CREATE INDEX `fk_ventas_empleados` ON `pos_tienda`.`ventas` (`id_empleado` ASC) VISIBLE;

CREATE INDEX `fk_ventas_clientes` ON `pos_tienda`.`ventas` (`id_cliente` ASC) VISIBLE;


-- -----------------------------------------------------
-- Table `pos_tienda`.`ventas_detalle`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `pos_tienda`.`ventas_detalle` (
  `id_venta` INT NOT NULL,
  `id_producto` INT NOT NULL,
  `cantidad` INT NOT NULL,
  `precio_aplicado` DECIMAL(10,2) NOT NULL,
  PRIMARY KEY (`id_venta`, `id_producto`),
  CONSTRAINT `fk_detalle_productos`
    FOREIGN KEY (`id_producto`)
    REFERENCES `pos_tienda`.`productos` (`id_producto`)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,
  CONSTRAINT `fk_detalle_ventas`
    FOREIGN KEY (`id_venta`)
    REFERENCES `pos_tienda`.`ventas` (`id_venta`)
    ON DELETE CASCADE
    ON UPDATE CASCADE)
ENGINE = InnoDB
DEFAULT CHARACTER SET = utf8mb4
COLLATE = utf8mb4_0900_ai_ci;

CREATE INDEX `fk_detalle_productos` ON `pos_tienda`.`ventas_detalle` (`id_producto` ASC) VISIBLE;


SET SQL_MODE=@OLD_SQL_MODE;
SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS;
SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS;
