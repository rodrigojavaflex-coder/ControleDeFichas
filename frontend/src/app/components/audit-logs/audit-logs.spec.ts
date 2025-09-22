import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';

import { AuditLogsComponent } from './audit-logs';

describe('AuditLogsComponent', () => {
  let component: AuditLogsComponent;
  let fixture: ComponentFixture<AuditLogsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        AuditLogsComponent,
        HttpClientTestingModule,
        RouterTestingModule
      ]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(AuditLogsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load audit logs on init', () => {
    spyOn(component, 'loadAuditLogs');
    component.ngOnInit();
    expect(component.loadAuditLogs).toHaveBeenCalled();
  });

  it('should toggle filters panel', () => {
    expect(component.showFilters).toBeFalse();
    component.toggleFilters();
    expect(component.showFilters).toBeTrue();
    component.toggleFilters();
    expect(component.showFilters).toBeFalse();
  });

  it('should clear filters', () => {
    component.selectedUserId = 'test-user';
    component.selectedAction = 'USER_CREATE';
    component.searchText = 'test search';
    
    component.clearFilters();
    
    expect(component.selectedUserId).toBe('');
    expect(component.selectedAction).toBe('');
    expect(component.searchText).toBe('');
  });

  it('should format date correctly', () => {
    const testDate = new Date('2023-09-21T12:00:00Z');
    const formatted = component.formatDate(testDate);
    expect(formatted).toBeDefined();
    expect(typeof formatted).toBe('string');
  });

  it('should format JSON data', () => {
    const testData = { name: 'test', value: 123 };
    const formatted = component.formatJson(testData);
    expect(formatted).toContain('name');
    expect(formatted).toContain('test');
  });
});