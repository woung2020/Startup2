const firebaseConfig = {
    apiKey: "AIzaSyDinTxM2TbKQY9KN7Hj7Ey5-bxGaBlm7bg",
    authDomain: "startup2-c50b9.firebaseapp.com",
    databaseURL: "https://startup2-c50b9-default-rtdb.firebaseio.com",
    projectId: "startup2-c50b9",
    storageBucket: "startup2-c50b9.firebasestorage.app",
    messagingSenderId: "545978548363",
    appId: "1:545978548363:web:a5b2386c557a89c318948e",
    measurementId: "G-K9W3YCQLHY"
};


// Firebase 초기화
firebase.initializeApp(firebaseConfig);
const teamRef = firebase.database().ref('teams');
const investorsRef = firebase.database().ref('investors');

let teamsData = [];
let investorsData = [];
// ⚠️ 반드시 비밀번호를 변경하세요!
const ADMIN_PASSWORD = '6566';
let currentStudent = null;

const app = document.getElementById('app');

// ✅ 고정된 투자 금액 (만원 단위)
const FIXED_INVESTMENT_AMOUNTS = [300, 250, 200, 150, 100, 50];
const MAX_TOTAL_INVESTMENT = 1000; // 1,000만원

// URL에서 관리자 모드 상태 로드
function getUrlParams() {
    const params = new URLSearchParams(window.location.search);
    return {
        isAdmin: params.get('mode') === 'admin',
    };
}

// URL에 상태 저장 (관리자 모드)
function updateUrl(isAdmin) {
    const url = new URL(window.location.href);
    if (isAdmin) {
        url.searchParams.set('mode', 'admin');
    } else {
        url.searchParams.delete('mode');
    }
    window.history.pushState({}, '', url);
}

// 수익률 계산 함수 (단위: 만원)
function calculateReturn(investment, rank) {
    let bonusFactor = 1.0;
    if (rank === 1) bonusFactor = 1.5;
    else if (rank === 2) bonusFactor = 1.3;
    else if (rank === 3) bonusFactor = 1.2;
    else if (rank >= 4 && rank <= 10) bonusFactor = 1.1;
    return investment * bonusFactor;
}

// 학번에서 반 정보를 추출하는 헬퍼 함수
// 예: 20419 -> 2학년 04반 -> 2학년 4반
function getClassName(studentId) {
    if (typeof studentId === 'string' && studentId.length >= 3) {
        // 학번 5자리에서 1번째 자리는 학년, 2~3번째 자리는 반
        const grade = studentId.substring(0, 1);
        const classNum = parseInt(studentId.substring(1, 3), 10);
        return `${grade}학년 ${classNum}반`;
    }
    return '반 정보 없음';
}

// 렌더링 함수
function render() {
    const { isAdmin } = getUrlParams();
    
    // ✅ 렌더링 로직 시작 시, 현재 화면이 로그인 상태가 아닐 경우만 초기화 (로그인 중 입력 유지)
    if (app.querySelector('#student-login') === null) {
        app.innerHTML = ''; // 기존 내용 초기화
    }

    // ✅ 팀 순위 계산
    const teamRanks = teamsData
        .map((team, index) => ({
            name: team.name,
            totalInvestment: team.totalInvestment || 0,
            id: team.id,
            originalIndex: index,
        }))
        .sort((a, b) => b.totalInvestment - a.totalInvestment)
        .map((team, index) => ({
            ...team,
            rank: index + 1,
        }));

    // ✅ 학생 순위 계산 (전체 순위)
    const investorRanks = investorsData
        .map((investor) => {
            let totalReturn = 0;
            const investments = Object.values(investor.investments || {});
            investments.forEach((inv) => {
                const team = teamRanks.find((t) => t.id === inv.teamId);
                if (team) {
                    totalReturn += calculateReturn(inv.amount, team.rank);
                }
            });
            return {
                ...investor,
                totalReturn: totalReturn,
            };
        })
        .sort((a, b) => b.totalReturn - a.totalReturn)
        .map((investor, index) => ({
            ...investor,
            rank: index + 1, // 전체 순위
        }));

    // ✅ 반별 학생 순위 계산 및 정렬
    const classInvestments = investorRanks.reduce((acc, investor) => {
        const className = getClassName(investor.studentId);
        if (!acc[className]) {
            acc[className] = [];
        }
        acc[className].push(investor);
        return acc;
    }, {});

    const classRanks = Object.keys(classInvestments).map(className => {
        // 반 내에서 총 수익 기준으로 다시 정렬하여 반별 순위를 매깁니다.
        const rankedStudents = classInvestments[className]
            .sort((a, b) => b.totalReturn - a.totalReturn)
            .map((student, index) => ({
                ...student,
                classRank: index + 1 // 반 내 순위
            }));

        return {
            className: className,
            students: rankedStudents
        };
    }).sort((a, b) => {
        // 반 이름으로 정렬 (예: 2학년 1반, 2학년 10반 순)
        return a.className.localeCompare(b.className, 'ko', { numeric: true });
    });


    // 관리자 모드 렌더링
    if (isAdmin) {
        // 관리자 모드로 전환될 때는 전체 초기화
        app.innerHTML = ''; 
        app.innerHTML = `
            <section id="admin-mode">
                <h2>관리자 모드</h2>
                <div class="button-group">
                    <button id="switch-mode-btn">학생 모드로 전환</button>
                </div>
                
                <h3>1. 창업팀 목록 관리</h3>
                <textarea id="teams-textarea" rows="10"></textarea>
                <p>명칭을 한 줄에 하나씩 입력하세요.</p>
                <button id="save-teams-btn">팀 명칭 저장</button>
                <br/><br/>
                <input type="file" id="file-upload" accept=".csv, .xlsx" />
                <p>엑셀 파일 (.xlsx, .csv) 업로드</p>

                <h3>2. 팀별 투자 현황</h3>
                <ul id="team-rank-list"></ul>

                <h3>3. 전체 학생 투자 현황</h3>
                <ul id="investor-rank-list"></ul>

                <hr/>
                
                <h3>4. 반별 학생 투자 순위 🏆</h3> 
                <div id="class-rank-lists"></div> 
            </section>
        `;
        // 팀 명칭 수정
        const teamsTextarea = document.getElementById('teams-textarea');
        teamsTextarea.value = teamsData.map(t => t.name).join('\n');
        document.getElementById('save-teams-btn').addEventListener('click', () => {
            const newNames = teamsTextarea.value.split('\n').filter(name => name.trim() !== '');
            const newTeamsData = {};
            newNames.forEach((name, index) => {
                const key = `team${Date.now() + index}`;
                const existingTeam = teamsData.find(t => t.name === name);
                newTeamsData[key] = {
                    id: key,
                    name: name,
                    totalInvestment: existingTeam ? existingTeam.totalInvestment : 0,
                };
            });
            firebase.database().ref('teams').set(newTeamsData);
        });

        // 파일 업로드
        document.getElementById('file-upload').addEventListener('change', handleFileUpload);
        
        // 팀 순위 리스트
        const teamRankList = document.getElementById('team-rank-list');
        teamRanks.forEach(team => {
            const li = document.createElement('li');
            li.className = 'team-item';
            if (team.rank <= 3) li.classList.add('top-3');
            li.innerHTML = `
                <div class="team-info">
                    <span class="rank-badge">${team.rank}위</span>
                    <strong>${team.name}</strong>
                    <span>총 투자금: ${team.totalInvestment.toLocaleString()}만원</span>
                </div>
            `;
            teamRankList.appendChild(li);
        });

        // 전체 학생 순위 리스트
        const investorRankList = document.getElementById('investor-rank-list');
        investorRanks.forEach(investor => {
            const li = document.createElement('li');
            li.className = 'investor-item';
            if (investor.rank <= 3) li.classList.add('top-3');
            li.innerHTML = `
                <div class="team-info">
                    <span class="rank-badge">${investor.rank}위</span>
                    <strong>${investor.studentId} ${investor.name}</strong>
                    <span>총 수익: ${investor.totalReturn.toLocaleString()}만원</span>
                </div>
            `;
            investorRankList.appendChild(li);
        });

        // 반별 학생 순위 리스트 렌더링
        const classRankListsDiv = document.getElementById('class-rank-lists');
        classRanks.forEach(classData => {
            const classSection = document.createElement('div');
            classSection.innerHTML = `
                <h4>${classData.className} 순위 (${classData.students.length}명)</h4>
                <ul class="class-rank-list">
                    ${classData.students.map(student => `
                        <li class="investor-item ${student.classRank <= 3 ? 'top-3-class' : ''}">
                            <div class="team-info">
                                <span class="rank-badge">${student.classRank}위 (전체 ${student.rank}위)</span>
                                <strong>${student.studentId} ${student.name}</strong>
                                <span>총 수익: ${student.totalReturn.toLocaleString()}만원</span>
                            </div>
                        </li>
                    `).join('')}
                </ul>
            `;
            classRankListsDiv.appendChild(classSection);
        });
        
        // 모드 전환 버튼
        document.getElementById('switch-mode-btn').addEventListener('click', () => {
            updateUrl(false);
            render();
        });

    } else { // 학생 모드 렌더링
        if (!currentStudent) {
            // 로그인 화면
            // ✅ 이 때만 app.innerHTML = '' 초기화를 하지 않아 입력 필드 내용 유지
            if (app.querySelector('#student-login') === null) {
                app.innerHTML = '';
            }
            
            app.innerHTML = `
                <section id="student-login">
                    <h2>학생 투자 참여<span class="by"> by 차현준</span></h2>
                    <div class="input-group">
                        <label for="student-id">학번 (숫자 5자리)</label>
                        <input type="text" id="student-id" placeholder="예: 20419" required maxlength="5" value="${currentStudent ? currentStudent.studentId : ''}">
                    </div>
                    <div class="input-group">
                        <label for="student-name">이름</label>
                        <input type="text" id="student-name"  placeholder="예: 차현준" required value="${currentStudent ? currentStudent.name : ''}">
                    </div>
                    <button id="start-investment-btn">투자 시작</button>
                </section>
                <div class="button-group">
                    <button id="admin-login-btn">관리자 로그인</button>
                </div>
            `;
            document.getElementById('start-investment-btn').addEventListener('click', () => {
                const studentId = document.getElementById('student-id').value;
                const studentName = document.getElementById('student-name').value;

                if (!/^\d{5}$/.test(studentId)) {
                    alert('학번은 반드시 5자리 숫자로 입력해야 합니다.');
                    return;
                }

                if (studentId && studentName) {
                    firebase.database().ref(`investors/${studentId}`).once('value', (snapshot) => {
                        const existingStudent = snapshot.val();
                        if (existingStudent) {
                            currentStudent = existingStudent;
                        } else {
                            // 총 투자액도 0원으로 초기화
                            currentStudent = { studentId, name: studentName, totalInvestment: 0, investments: {} };
                            firebase.database().ref(`investors/${studentId}`).set(currentStudent);
                        }
                        render(); // 투자 화면으로 전환
                    });
                } else {
                    alert('학번과 이름을 모두 입력하세요.');
                }
            });
            
            // 관리자 로그인 버튼
            document.getElementById('admin-login-btn').addEventListener('click', () => {
                const password = prompt("관리자 비밀번호를 입력하세요.");
                if (password === ADMIN_PASSWORD) {
                    updateUrl(true);
                    render();
                } else {
                    alert("비밀번호가 틀렸습니다.");
                }
            });

        } else {
            // 투자 화면
            // ✅ 투자 화면으로 전환 시에만 전체 초기화
            app.innerHTML = ''; 
            app.innerHTML = `
                <section id="student-mode">
                    <h2>학생 투자 모드<span class="by"> by 차현준</span></h2>
                    <p id="student-info"><strong>${currentStudent.name}</strong>님 (${currentStudent.studentId})</p>
                    <div id="investment-status">
                        <p>총 투자 가능 금액: ${MAX_TOTAL_INVESTMENT.toLocaleString()}만원</p>
                        <p>현재 투자액: <span id="current-investment">0만원</span></p>
                        <p>남은 투자 가능액: <span id="remaining-investment">${MAX_TOTAL_INVESTMENT.toLocaleString()}만원</span></p>
                    </div>
                    <hr>
                    <h3>창업팀 목록 (팀당 1회 투자 가능)</h3>
                    <ul id="team-list"></ul>
                    <h3>나의 투자 현황</h3>
                    <ul id="my-investments"></ul>
                    <div class="button-group">
                        <button id="clear-investments-btn">내 투자 초기화</button>
                        <button id="switch-mode-btn">관리자 모드로 전환</button>
                    </div>
                </section>
            `;

            // 투자 현황 업데이트
            const updateInvestmentStatus = () => {
                const investedAmount = currentStudent.investments ? Object.values(currentStudent.investments).reduce((sum, inv) => sum + inv.amount, 0) : 0;
                document.getElementById('current-investment').textContent = investedAmount.toLocaleString() + '만원';
                document.getElementById('remaining-investment').textContent = (MAX_TOTAL_INVESTMENT - investedAmount).toLocaleString() + '만원';
            };

            const teamList = document.getElementById('team-list');
            const myInvestmentsList = document.getElementById('my-investments');
            
            teamsData.forEach(team => {
                const li = document.createElement('li');
                const isInvested = currentStudent.investments && currentStudent.investments[team.id];
                
                li.className = 'team-item' + (isInvested ? ' invested-team' : '');
                
                // ✅ 셀렉트 박스 생성
                const investedAmount = currentStudent.investments ? Object.values(currentStudent.investments).reduce((sum, inv) => sum + inv.amount, 0) : 0;
                const remainingAmount = MAX_TOTAL_INVESTMENT - investedAmount;

                const selectOptions = FIXED_INVESTMENT_AMOUNTS
                    .filter(amount => amount <= remainingAmount) // 남은 금액보다 적거나 같은 금액만 표시
                    .map(amount => `<option value="${amount}">${amount.toLocaleString()}만원</option>`)
                    .join('');

                li.innerHTML = `
                    <div class="team-info">
                        <strong>${team.name}</strong>
                    </div>
                    <div class="invest-form">
                        ${isInvested 
                            ? `<span class="error-message">✅ 이미 투자 완료 (투자액: ${currentStudent.investments[team.id].amount.toLocaleString()}만원)</span>`
                            : `<select class="investment-select" data-team-id="${team.id}">
                                    <option value="">금액 선택</option>
                                    ${selectOptions}
                                </select>
                                <button class="invest-btn" data-team-id="${team.id}" disabled>투자하기</button>`
                        }
                    </div>
                `;
                teamList.appendChild(li);
            });

            // ✅ 셀렉트 박스 변경 이벤트 (버튼 활성화/비활성화)
            document.querySelectorAll('.investment-select').forEach(select => {
                const button = select.closest('.invest-form').querySelector('.invest-btn');
                select.addEventListener('change', (e) => {
                    const amount = parseInt(e.target.value);
                    if (amount > 0) {
                        button.disabled = false;
                    } else {
                        button.disabled = true;
                    }
                });
            });

            // ✅ 투자 버튼 클릭 이벤트
            document.querySelectorAll('.invest-btn').forEach(button => {
                button.addEventListener('click', (e) => {
                    const teamId = e.target.dataset.teamId;
                    const select = e.target.closest('.invest-form').querySelector('.investment-select');
                    const amount = parseInt(select.value); // 사용자 선택 금액 (만원 단위)

                    if (isNaN(amount) || amount <= 0) {
                        alert('투자 금액을 선택해주세요.');
                        return;
                    }

                    // 한 팀당 1회 투자 제한 확인
                    if (currentStudent.investments && currentStudent.investments[teamId]) {
                        alert('이미 이 팀에 투자하셨습니다. 다른 팀에 투자해주세요.');
                        render(); // 혹시 모를 버그 방지
                        return;
                    }

                    const totalInvestedAmount = currentStudent.investments ? Object.values(currentStudent.investments).reduce((sum, inv) => sum + inv.amount, 0) : 0;
                    
                    if (totalInvestedAmount + amount > MAX_TOTAL_INVESTMENT) {
                        alert(`총 투자 가능 금액 ${MAX_TOTAL_INVESTMENT.toLocaleString()}만원을 초과할 수 없습니다.`);
                        return;
                    }

                    const updates = {};
                    const teamToUpdate = teamsData.find(t => t.id === teamId);
                    
                    if (teamToUpdate) {
                        // 학생의 투자 정보 업데이트 
                        updates[`investors/${currentStudent.studentId}/investments/${teamId}`] = { teamId, amount: amount };
                        
                        // 팀의 총 투자금 업데이트
                        updates[`teams/${teamToUpdate.id}/totalInvestment`] = (teamToUpdate.totalInvestment || 0) + amount;
                    } else {
                        console.error("오류: 투자를 시도한 팀을 찾을 수 없습니다.");
                        alert("투자에 실패했습니다. 팀을 찾을 수 없습니다.");
                        return;
                    }
                    
                    firebase.database().ref().update(updates)
                        .then(() => {
                            alert(`투자가 완료되었습니다! (${amount.toLocaleString()}만원)`);
                            // DB 리스너가 호출되어 자동으로 UI 업데이트 됨
                        })
                        .catch(error => {
                            console.error("투자 업데이트 실패: ", error);
                            alert('투자에 실패했습니다.');
                        });
                });
            });

            // 나의 투자 현황 업데이트
            const updateMyInvestments = () => {
                myInvestmentsList.innerHTML = '';
                if (currentStudent.investments) {
                    Object.values(currentStudent.investments).forEach(inv => {
                        const team = teamsData.find(t => t.id === inv.teamId);
                        if (team) {
                            const li = document.createElement('li');
                            li.innerHTML = `<strong>${team.name}</strong>: ${inv.amount.toLocaleString()}만원`;
                            myInvestmentsList.appendChild(li);
                        }
                    });
                }
            };
            updateMyInvestments();
            updateInvestmentStatus();

            // 내 투자 초기화 버튼
            document.getElementById('clear-investments-btn').addEventListener('click', () => {
                if (!confirm('정말로 모든 투자를 초기화하시겠습니까? (이 작업은 되돌릴 수 없습니다!)')) return;
                if (!currentStudent.investments) return;

                const updates = {};
                Object.values(currentStudent.investments).forEach(inv => {
                    const teamToUpdate = teamsData.find(t => t.id === inv.teamId);
                    if (teamToUpdate) {
                        const currentTeamInvestment = teamToUpdate.totalInvestment || 0;
                        updates[`teams/${teamToUpdate.id}/totalInvestment`] = currentTeamInvestment - inv.amount;
                    }
                });
                updates[`investors/${currentStudent.studentId}/investments`] = null;

                firebase.database().ref().update(updates)
                    .then(() => {
                        alert('투자가 성공적으로 초기화되었습니다.');
                        // DB 리스너가 호출되어 자동으로 UI 업데이트 됨
                    })
                    .catch(error => {
                        console.error("초기화 실패: ", error);
                        alert('투자 초기화에 실패했습니다.');
                    });
            });

            // 모드 전환 버튼
            document.getElementById('switch-mode-btn').addEventListener('click', () => {
                const password = prompt("관리자 비밀번호를 입력하세요.");
                if (password === ADMIN_PASSWORD) {
                    updateUrl(true);
                    render();
                } else {
                    alert("비밀번호가 틀렸습니다.");
                }
            });
        }
    }
}

// ✅ Firebase 실시간 동기화 리스너
// DB가 변경될 때마다 데이터를 업데이트하지만, UI 렌더링은 필요한 경우에만 합니다.

teamRef.on('value', (snapshot) => {
    const data = snapshot.val();
    if (data) {
        teamsData = Object.keys(data).map(key => ({ id: key, ...data[key] }));
    } else {
        teamsData = [];
    }
    // 데이터 변경이 관리자 모드나 로그인 후 투자 모드에만 영향을 미치므로 조건부 호출
    const { isAdmin } = getUrlParams();
    if (isAdmin || currentStudent) {
        render(); 
    }
});

investorsRef.on('value', (snapshot) => {
    const data = snapshot.val();
    investorsData = data ? Object.values(data) : [];
    
    // 현재 학생 객체를 최신 DB 데이터로 업데이트
    if(currentStudent && data) {
        const updatedStudent = data[currentStudent.studentId];
        if (updatedStudent) {
            currentStudent = updatedStudent;
        } 
    }
    
    // ✅ UI를 다시 그리는 render() 함수를 무조건 호출하지 않고,
    // 관리자 모드이거나 학생이 로그인 상태일 때만 호출하여 입력 중인 화면을 덮어쓰는 것을 방지
    const { isAdmin } = getUrlParams();
    if (isAdmin || currentStudent) {
        render(); 
    }
});

// 파일 업로드 처리 함수 (로직 변경 없음)
function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) {
        alert("파일을 선택해주세요.");
        return;
    }

    const reader = new FileReader();
    reader.onload = (evt) => {
        const data = new Uint8Array(evt.target.result);
        if (typeof XLSX === 'undefined') {
            alert('XLSX 라이브러리가 로드되지 않았습니다.');
            return;
        }
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        const names = rows.flat().filter(name => name && typeof name === 'string' && name.trim() !== '');

        if (names.length === 0) {
            alert("파일에서 유효한 팀 이름을 찾을 수 없습니다.");
            return;
        }

        const newTeamsData = {};
        names.forEach((name, index) => {
            const key = `team${Date.now() + index}`;
            newTeamsData[key] = {
                id: key,
                name: name,
                totalInvestment: 0,
            };
        });
        firebase.database().ref('teams').set(newTeamsData)
            .then(() => alert('팀 명칭이 성공적으로 업데이트되었습니다.'))
            .catch(error => alert('팀 명칭 업데이트 실패: ' + error.message));
    };
    reader.readAsArrayBuffer(file);
}

render();