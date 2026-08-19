import { Module } from "@nestjs/common";
import { RoutineController } from "./routine.controller";
import { RoutineService } from "./routine.service";

@Module({
    providers:[RoutineService],
    controllers:[RoutineController],
})

export class RoutineModule{}