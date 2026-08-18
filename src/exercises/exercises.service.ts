import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateExercisesDto } from "./dto/create-exercises.dto";

@Injectable()

export class ExercisesService {
    constructor(private readonly prisma: PrismaService) {}

    async create(dataDtos: CreateExercisesDto){
        return this.prisma.exercise.create({
            data: dataDtos,
        })
    }

    async list(){
        return this.prisma.exercise.findMany();
    }
}