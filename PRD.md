# coroom — 회의실 예약 시스템 PRD

## 1. 개요

| 항목 | 내용 |
|---|---|
| 서비스명 | **coroom** (co-room: 함께 쓰는 회의실) |
| 한 줄 정의 | 사내 회의실 6개의 예약 현황을 한눈에 보고, 빈 시간을 클릭해 바로 예약할 수 있는 웹 서비스 |
| 사용 대상 | 사내 임직원 (전 부서) |
| 데이터베이스 | Supabase (PostgreSQL + Auth + Realtime) |
| 문서 상태 | Draft v1.0 (2026-07-14) |

### 배경 / 문제 정의
- 현재 회의실 예약이 엑셀(`meetingroom_reservations.xlsx`)로 관리되어 실시간 현황 파악이 어렵고, 중복 예약·확인 누락이 발생하기 쉽다.
- 회의실별 예약 가능 여부를 확인하려면 매번 파일을 열어 확인해야 하는 번거로움이 있다.
- **coroom은 이 엑셀 대장부를 대체**하여, 웹에서 실시간으로 예약 현황을 조회하고 빈 슬롯을 클릭 한 번으로 예약할 수 있게 한다.

## 2. 목표 및 성공 지표

| 목표 | 지표 |
|---|---|
| 예약 프로세스 간소화 | 예약 완료까지 클릭 3회 이내 |
| 중복 예약 방지 | 시간대 중복 예약 발생 건수 0건 |
| 현황 가시성 확보 | 회의실 6개 × 하루 전체 시간대를 스크롤 없이 한 화면에서 확인 |
| 실시간성 | 타인의 예약 생성/취소가 새로고침 없이 5초 이내 반영 (Supabase Realtime) |

## 3. 범위

### MVP (In-Scope)
- 회의실 목록/정보 조회
- 일/주 단위 예약 현황판 (그리드 뷰)
- 빈 시간 클릭 → 예약 생성
- 내 예약 목록 조회, 취소
- 실시간 동기화 (다른 사용자의 예약이 즉시 반영)
- 로그인 (사내 이메일 기반 Supabase Auth)

### Out-of-Scope (향후 로드맵)
- 회의실 자동 배정 추천
- 반복 예약(매주 반복 회의)
- 관리자 승인 워크플로우 (현재는 예약 즉시 확정 방식)
- 이메일/슬랙 알림
- 회의실 이용 통계 대시보드

## 4. 대상 회의실 정보

기존 `meetingroom_reservations.xlsx`의 "회의실목록" 시트를 기준으로 한다.

| 번호 | 회의실명 | 수용인원 | 층 | 보유 장비 | 비고 |
|---|---|---|---|---|---|
| 1 | 1번 회의실 (소회의실 A) | 4 | 3층 | TV, 화이트보드 | - |
| 2 | 2번 회의실 (소회의실 B) | 4 | 3층 | TV, 화이트보드 | - |
| 3 | 3번 회의실 (중회의실 A) | 8 | 3층 | 빔프로젝터, 화상회의 카메라 | - |
| 4 | 4번 회의실 (중회의실 B) | 8 | 4층 | 빔프로젝터, 화이트보드 | - |
| 5 | 5번 회의실 (대회의실) | 16 | 4층 | 빔프로젝터, 화상회의 카메라, 음향장비 | 임원 보고용 우선 배정 |
| 6 | 6번 회의실 (스튜디오) | 6 | 4층 | 방음시설, 녹화장비 | 면접/촬영 겸용 |

> 5번 회의실은 "임원 보고용 우선 배정" 비고가 있어, 향후 우선순위/승인 로직 확장 시 참고 필요 (MVP 범위 아님, 화면에는 비고로 노출만).

기존 예약 데이터(`예약현황` 시트, 25건)를 보면 상태값은 **확정 / 취소** 두 가지만 존재 → MVP는 별도 승인 절차 없이 예약 즉시 "확정" 처리하고, 사용자가 직접 "취소"할 수 있는 구조로 설계한다.

## 5. 대상 사용자

- **일반 임직원**: 회의실 현황 조회, 예약 생성/취소
- **(향후) 관리자**: 회의실 정보 관리, 전체 예약 관리 — MVP에서는 별도 관리자 화면 없이 DB로 관리

## 6. 핵심 기능

### 6.1 실시간 예약 현황판 (메인 대시보드)
- 세로축: 회의실 1~6번, 가로축: 시간대(예: 09:00~18:00, 30분 단위)
- 상단에서 날짜 선택(오늘/날짜 이동), 요일 탭 또는 주간 뷰 전환
- 예약된 슬롯은 회의 제목·예약자·부서가 표시된 블록으로 렌더링, 빈 슬롯은 클릭 가능한 빈 칸으로 표시
- 회의실별 정보(수용인원, 층, 장비)는 헤더에 툴팁/뱃지로 노출

### 6.2 빈 시간 클릭 예약
- 빈 슬롯 클릭 → 예약 모달 오픈 (회의실/날짜/시작·종료시간 사전 입력됨)
- 입력 항목: 회의 제목(필수), 예약자명(로그인 정보 자동 반영), 부서, 시작/종료 시간(드래그로 범위 조정 가능)
- 저장 시 서버(DB) 단에서 동일 회의실·시간대 중복 여부 검증 후 즉시 "확정" 처리
- 저장 즉시 Realtime으로 모든 접속자 화면에 반영

### 6.3 내 예약 관리
- "내 예약" 탭에서 본인이 만든 예약 목록(예정/지난 예약) 조회
- 예약 취소 기능 (상태를 '취소'로 변경, 슬롯은 다시 빈 시간으로 노출)

### 6.4 회의실 정보/필터
- 회의실 목록 페이지에서 수용인원, 장비 기준 필터링
- 예: "8인 이상 + 화상회의 카메라 보유 회의실만 보기"

### 6.5 로그인
- Supabase Auth (이메일/비밀번호 또는 매직링크) — 사내 임직원만 가입 가능하도록 이메일 도메인 제한

## 7. 사용자 플로우

```
로그인
  └→ 메인 대시보드 (오늘 날짜, 회의실 x 시간 그리드)
       ├→ 날짜/주간 이동
       ├→ 빈 슬롯 클릭 → 예약 모달 → 정보 입력 → 저장 → 확정 & 실시간 반영
       ├→ 예약된 슬롯 클릭 → 상세 정보 조회 (본인 예약이면 취소 버튼 노출)
       └→ "내 예약" 탭 → 예약 목록 → 취소
```

## 8. 화면 설계 (와이어프레임 개요)

**① 메인 대시보드**
```
[<  2026-07-14(화)  >]   [오늘]  [주간보기]        [내 예약] [로그아웃]
┌─────────┬────────────────────────────────────────────────┐
│ 회의실   │ 09  10  11  12  13  14  15  16  17  18          │
├─────────┼────────────────────────────────────────────────┤
│ 1번(4인) │        [고객사 화상미팅]                        │
│ 2번(4인) │              [거래처 미팅]                      │
│ 3번(8인) │    [고객사 화상미팅]                             │
│ 4번(8인) │                    [거래처 미팅]                │
│ 5번(16인)│                          [화상 회의]             │
│ 6번(6인) │                                                 │
└─────────┴────────────────────────────────────────────────┘
  빈 칸 클릭 → 예약 모달
```

**② 예약 모달**
```
회의실: 3번 회의실 (중회의실 A)         날짜: 2026-07-14
시작시간 [10:00 ▾]  종료시간 [11:00 ▾]
회의 제목 [_____________________]
부서     [_____________________]
        [취소]           [예약하기]
```

**③ 내 예약 목록**
```
예약번호   회의실     날짜         시간          제목            상태
B2026101   3번 회의실  2026-07-14  10:00-11:00  주간 팀 회의    확정   [취소]
```

## 9. 데이터 모델 (Supabase / PostgreSQL)

기존 엑셀의 두 시트(`회의실목록`, `예약현황`) 구조를 그대로 정규화하여 테이블로 이전한다.

```sql
create extension if not exists pgcrypto;
create extension if not exists btree_gist;

-- 회의실 목록
create table rooms (
  id smallint primary key,              -- 회의실번호 1~6
  name text not null,                   -- 회의실명 (예: "3번 회의실 (중회의실 A)")
  capacity smallint not null,           -- 수용인원
  floor text not null,                  -- 층
  equipment text[] not null default '{}', -- 보유장비
  note text                             -- 비고
);

-- 예약 상태
create type reservation_status as enum ('confirmed', 'cancelled');

-- 예약 현황
create table reservations (
  id uuid primary key default gen_random_uuid(),
  reservation_code text unique not null,   -- 예약번호 (예: B2026071)
  room_id smallint not null references rooms(id),
  user_id uuid not null references auth.users(id),
  reserver_name text not null,             -- 예약자
  department text not null,                -- 부서
  title text not null,                     -- 회의제목
  reservation_date date not null,          -- 예약일자
  start_time time not null,                -- 시작시간
  end_time time not null,                  -- 종료시간
  status reservation_status not null default 'confirmed',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint valid_time_range check (end_time > start_time)
);

-- 같은 회의실, 같은 시간대에 확정 예약이 겹치지 않도록 DB 레벨에서 강제
alter table reservations add constraint no_overlapping_reservations
  exclude using gist (
    room_id with =,
    tsrange(
      (reservation_date + start_time)::timestamp,
      (reservation_date + end_time)::timestamp
    ) with &&
  ) where (status = 'confirmed');

create index on reservations (room_id, reservation_date);
create index on reservations (user_id);
```

### RLS (Row Level Security) 정책
```sql
alter table rooms enable row level security;
alter table reservations enable row level security;

-- 로그인한 임직원 누구나 회의실 목록/예약 현황 조회 가능
create policy "rooms_select_all" on rooms
  for select using (auth.role() = 'authenticated');

create policy "reservations_select_all" on reservations
  for select using (auth.role() = 'authenticated');

-- 예약 생성은 본인 명의로만
create policy "reservations_insert_own" on reservations
  for insert with check (auth.uid() = user_id);

-- 취소(수정)는 본인 예약만
create policy "reservations_update_own" on reservations
  for update using (auth.uid() = user_id);
```

## 10. 기술 스택

| 영역 | 기술 |
|---|---|
| 프론트엔드 | HTML/CSS/JavaScript (SPA) |
| 백엔드/DB | Supabase (PostgreSQL, Auth, Realtime) |
| 실시간 동기화 | Supabase Realtime (postgres_changes 구독으로 예약 그리드 자동 갱신) |
| 인증 | Supabase Auth (이메일/비밀번호 또는 매직링크, 사내 도메인 제한) |

## 11. 비기능 요구사항

- **동시성**: 동일 시간대 동시 예약 시도 시 DB의 `exclude` 제약으로 하나만 성공, 나머지는 에러 처리 후 클라이언트에 안내
- **보안**: RLS로 본인 예약만 취소/수정 가능하도록 강제, 로그인 사용자만 접근 가능
- **성능**: 하루치 예약 현황 조회는 단일 쿼리(room_id, date 인덱스 활용)로 200ms 이내 응답 목표
- **가용성**: 예약 실패 시 명확한 에러 메시지(예: "이미 예약된 시간입니다") 제공

## 12. 리스크 및 제약사항

- 승인 절차 없이 즉시 확정되므로, 특정 회의실(5번 대회의실)의 "임원 우선 배정" 같은 정책은 MVP에서는 시스템적으로 강제하지 않음 (안내 문구로만 노출)
- 동시 클릭으로 인한 예약 경쟁은 DB 제약으로 방지하되, UX상 실패 안내가 즉각적이어야 함
- 반복 예약, 알림 기능 부재 → 향후 로드맵에서 확장

## 13. 향후 로드맵

1. 반복 예약 (주간 정기 회의)
2. 예약 전/후 알림 (이메일, 슬랙 연동)
3. 관리자 대시보드 (회의실 추가/수정, 전체 예약 통계)
4. 5번 회의실 임원 우선 배정 등 회의실별 예약 정책 고도화
5. 모바일 반응형 최적화
