import { Controller, Get, Post, Body } from "@nestjs/common";
import { ExercisesService } from "./exercises.service";
import { CreateExercisesDto } from "./dto/create-exercises.dto";

@Controller('exercises')

export class ExercisesController {
    constructor(private readonly ExercisesService: ExercisesService) {}

    @Post()
    create(@Body() dto: CreateExercisesDto) {
        return this.ExercisesService.create(dto)
    }
    @Get()
    list(){
        return this.ExercisesService.list()
    }
}