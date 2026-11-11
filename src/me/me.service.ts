import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateProfileDto } from './dto/update-profile.dto';

const HOUR = 3_600_000;
const SELECT = {
  sex: true,
  birthDate: true,
  heightCm: true,
  timezone: true,
} as const;

@Injectable()
export class MeService {
  constructor(private readonly prisma: PrismaService) {}

  private out(u: {
    sex: 'F' | 'M' | null;
    birthDate: Date | null;
    heightCm: number | null;
    timezone: string;
  }) {
    return {
      sex: u.sex,
      birthDate: u.birthDate ? u.birthDate.toISOString().slice(0, 10) : null,
      heightCm: u.heightCm,
      timezone: u.timezone,
    };
  }

  // U10: data real, de 1900-01-01 até hoje no calendário mais adiantado (UTC+14).
  private parseBirthDate(value: string) {
    const date = new Date(`${value}T00:00:00.000Z`);
    const today = new Date(Date.now() + 14 * HOUR).toISOString().slice(0, 10);
    if (
      isNaN(date.getTime()) ||
      date.toISOString().slice(0, 10) !== value ||
      value < '1900-01-01' ||
      value > today
    ) {
      throw new BadRequestException('birthDate inválida');
    }
    return date;
  }

  private checkTimezone(timeZone: string) {
    try {
      new Intl.DateTimeFormat('en', { timeZone });
    } catch {
      throw new BadRequestException('timezone inválido');
    }
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: SELECT,
    });
    return this.out(user);
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const data: Record<string, unknown> = {};
    if (dto.sex !== undefined) data.sex = dto.sex;
    if (dto.heightCm !== undefined) data.heightCm = dto.heightCm;
    if (dto.birthDate !== undefined) {
      data.birthDate =
        dto.birthDate === null ? null : this.parseBirthDate(dto.birthDate);
    }
    if (dto.timezone !== undefined) {
      this.checkTimezone(dto.timezone);
      data.timezone = dto.timezone;
    }
    const user = await this.prisma.user.update({
      where: { id: userId },
      data,
      select: SELECT,
    });
    return this.out(user);
  }
}
