import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AppService } from './app.service';

@ApiTags('App')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('config/google-maps-key')
  @ApiOperation({ summary: 'Chave pública do Google Maps (mesma origem do OMNI)' })
  @ApiResponse({ status: 200 })
  getGoogleMapsKey(): { key: string } {
    return this.appService.getGoogleMapsKey();
  }
}
