import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { FoodState, Prisma } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import { CsvSyntaxError, parseCsv, parseDecimal } from './csv';
import { CreateFoodDto } from './dto/create-food.dto';
import { ListFoodsQueryDto } from './dto/list-foods-query.dto';
import { UpdateFoodDto } from './dto/update-food.dto';

const NOT_FOUND = 'Alimento não encontrado';
const IN_USE = 'Alimento em uso em rendimento';
const CATALOG_LOCKED = 'Alimento do catálogo não pode ser alterado';

// Sem userId: o dono nunca sai na resposta.
const publicFields = {
  id: true,
  name: true,
  state: true,
  kcal: true,
  proteinG: true,
  carbsG: true,
  fatG: true,
  fiberG: true,
  tags: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.FoodSelect;

// A3: soma em décimos inteiros, sem erro de ponto flutuante.
const tenths = (v: number | Prisma.Decimal | null | undefined) =>
  v === null || v === undefined ? 0 : Math.round(Number(v) * 10);

function assertSum(p: number, c: number, f: number, fiber: number | null) {
  if (tenths(p) + tenths(c) + tenths(f) + tenths(fiber) > 1000) {
    throw new BadRequestException(
      'proteinG + carbsG + fatG + fiberG não pode passar de 100',
    );
  }
}

const REQUIRED_COLUMNS = [
  'name',
  'state',
  'kcal',
  'proteinG',
  'carbsG',
  'fatG',
];
const OPTIONAL_COLUMNS = ['fiberG', 'tags'];
const NUMERIC_COLUMNS = ['kcal', 'proteinG', 'carbsG', 'fatG', 'fiberG'];
const MAX_IMPORT = 500;

@Injectable()
export class FoodsService {
  constructor(private readonly prisma: PrismaService) {}

  create(userId: string, dto: CreateFoodDto) {
    assertSum(dto.proteinG, dto.carbsG, dto.fatG, dto.fiberG ?? null);
    return this.prisma.food.create({
      data: {
        userId,
        name: dto.name,
        state: dto.state,
        kcal: dto.kcal,
        proteinG: dto.proteinG,
        carbsG: dto.carbsG,
        fatG: dto.fatG,
        fiberG: dto.fiberG ?? null,
        tags: dto.tags ?? [],
      },
      select: publicFields,
    });
  }

  // A9: importação por CSV, tudo ou nada.
  async importCsv(
    userId: string,
    file: { buffer: Buffer; size: number } | undefined,
  ) {
    if (!file || file.size === 0) {
      throw new BadRequestException('Arquivo CSV ausente ou vazio');
    }
    let text: string;
    try {
      text = new TextDecoder('utf-8', { fatal: true }).decode(file.buffer);
    } catch {
      throw new BadRequestException(
        'Arquivo precisa estar em UTF-8 (no Excel: salvar como CSV UTF-8)',
      );
    }
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

    let records: ReturnType<typeof parseCsv>;
    try {
      records = parseCsv(text);
    } catch (e) {
      if (e instanceof CsvSyntaxError) {
        throw new BadRequestException({
          message: e.message,
          errors: [{ line: e.line, message: e.message }],
        });
      }
      throw e;
    }
    if (records.length < 2) {
      throw new BadRequestException('Arquivo sem alimentos');
    }
    if (records.length - 1 > MAX_IMPORT) {
      throw new BadRequestException(
        `Máximo de ${MAX_IMPORT} alimentos por arquivo`,
      );
    }

    const [{ fields: header }, ...rows] = records;
    const known = [...REQUIRED_COLUMNS, ...OPTIONAL_COLUMNS];
    for (const col of header) {
      if (!known.includes(col)) {
        // Sem eco do arquivo: o nome vem do usuário e pode ter até 256 KB.
        const name = col.length > 50 ? `${col.slice(0, 50)}…` : col;
        throw new BadRequestException(`Coluna desconhecida: ${name}`);
      }
      if (header.indexOf(col) !== header.lastIndexOf(col)) {
        throw new BadRequestException(`Coluna repetida: ${col}`);
      }
    }
    for (const col of REQUIRED_COLUMNS) {
      if (!header.includes(col)) {
        throw new BadRequestException(`Coluna obrigatória ausente: ${col}`);
      }
    }

    const errors: { line: number; message: string }[] = [];
    const data: Prisma.FoodCreateManyInput[] = [];
    for (const { line, fields } of rows) {
      if (fields.length !== header.length) {
        errors.push({
          line,
          message: `Esperado ${header.length} campos, encontrado ${fields.length}`,
        });
        continue;
      }
      const cell = (col: string) => fields[header.indexOf(col)];
      const raw: Record<string, unknown> = {
        name: cell('name'),
        state: cell('state'),
      };
      const problems: string[] = [];
      for (const col of NUMERIC_COLUMNS) {
        if (!header.includes(col)) continue;
        const text = cell(col);
        if (text === '' && col === 'fiberG') {
          raw[col] = null;
        } else if (text === '') {
          problems.push(`${col} é obrigatório`);
        } else {
          const n = parseDecimal(text);
          if (n === undefined) problems.push(`${col} não é um número válido`);
          raw[col] = n;
        }
      }
      if (header.includes('tags')) {
        raw.tags = cell('tags') === '' ? [] : cell('tags').split('|');
      }
      if (problems.length === 0) {
        const dto = plainToInstance(CreateFoodDto, raw);
        for (const err of validateSync(dto, { whitelist: true })) {
          problems.push(...Object.values(err.constraints ?? {}));
        }
        if (problems.length === 0) {
          try {
            assertSum(dto.proteinG, dto.carbsG, dto.fatG, dto.fiberG ?? null);
          } catch (e) {
            problems.push((e as BadRequestException).message);
          }
          data.push({
            userId,
            name: dto.name,
            state: dto.state,
            kcal: dto.kcal,
            proteinG: dto.proteinG,
            carbsG: dto.carbsG,
            fatG: dto.fatG,
            fiberG: dto.fiberG ?? null,
            tags: dto.tags ?? [],
          });
        }
      }
      for (const message of problems) errors.push({ line, message });
    }
    if (errors.length > 0) {
      throw new BadRequestException({
        message: 'Arquivo com linhas inválidas',
        errors,
      });
    }
    const { count } = await this.prisma.food.createMany({ data });
    return { imported: count };
  }

  findAll(userId: string, query: ListFoodsQueryDto) {
    return this.prisma.food.findMany({
      where: {
        OR: [{ userId: null }, { userId }],
        ...(query.search !== undefined && {
          // A4: o contains do Prisma não escapa o LIKE; \, % e _ viram texto.
          name: {
            contains: query.search.replace(/[\\%_]/g, '\\$&'),
            mode: 'insensitive',
          },
        }),
        ...(query.state !== undefined && { state: query.state }),
        ...(query.tag !== undefined && { tags: { hasEvery: query.tag } }),
      },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      select: publicFields,
    });
  }

  async findOne(userId: string, id: string) {
    const food = await this.prisma.food.findFirst({
      where: { id, OR: [{ userId: null }, { userId }] },
      select: publicFields,
    });
    if (!food) throw new NotFoundException(NOT_FOUND);
    return food;
  }

  async update(userId: string, id: string, dto: UpdateFoodDto) {
    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<
        {
          user_id: string | null;
          state: FoodState;
          protein_g: Prisma.Decimal;
          carbs_g: Prisma.Decimal;
          fat_g: Prisma.Decimal;
          fiber_g: Prisma.Decimal | null;
        }[]
      >`SELECT user_id, state, protein_g, carbs_g, fat_g, fiber_g FROM foods WHERE id = ${id} AND (user_id = ${userId} OR user_id IS NULL) FOR UPDATE`;
      if (rows.length === 0) throw new NotFoundException(NOT_FOUND);
      const row = rows[0];
      if (row.user_id === null) throw new ForbiddenException(CATALOG_LOCKED);
      if (dto.state !== undefined && dto.state !== row.state) {
        await this.assertNotInYield(tx, id);
      }
      assertSum(
        dto.proteinG ?? Number(row.protein_g),
        dto.carbsG ?? Number(row.carbs_g),
        dto.fatG ?? Number(row.fat_g),
        dto.fiberG === undefined
          ? row.fiber_g === null
            ? null
            : Number(row.fiber_g)
          : dto.fiberG,
      );
      return tx.food.update({
        where: { id },
        data: {
          name: dto.name,
          state: dto.state,
          kcal: dto.kcal,
          proteinG: dto.proteinG,
          carbsG: dto.carbsG,
          fatG: dto.fatG,
          fiberG: dto.fiberG,
          tags: dto.tags,
        },
        select: publicFields,
      });
    });
  }

  private async assertNotInYield(tx: Prisma.TransactionClient, id: string) {
    const used = await tx.foodYield.findFirst({
      where: { OR: [{ rawFoodId: id }, { cookedFoodId: id }] },
      select: { id: true },
    });
    if (used) throw new ConflictException(IN_USE);
  }

  async remove(userId: string, id: string) {
    try {
      await this.prisma.$transaction(async (tx) => {
        const rows = await tx.$queryRaw<{ user_id: string | null }[]>`
          SELECT user_id FROM foods
          WHERE id = ${id} AND (user_id = ${userId} OR user_id IS NULL)
          FOR UPDATE`;
        if (rows.length === 0) throw new NotFoundException(NOT_FOUND);
        if (rows[0].user_id === null) {
          throw new ForbiddenException(CATALOG_LOCKED);
        }
        await this.assertNotInYield(tx, id);
        await tx.food.deleteMany({ where: { id, userId } });
      });
    } catch (e) {
      // Rede de segurança: a FK RESTRICT barrou um rendimento que escapou da checagem.
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2003'
      ) {
        throw new ConflictException(IN_USE);
      }
      throw e;
    }
  }
}
